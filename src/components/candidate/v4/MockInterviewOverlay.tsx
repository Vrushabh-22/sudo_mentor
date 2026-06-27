import React, { useEffect, useRef, useState, useCallback } from 'react';
import { V4Profile } from '@/pages/CandidatePortalV4';
import { SUPABASE_URL, supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, VolumeX, X, Keyboard, Send, Loader2, Video, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIOrb, OrbState } from './interview/AIOrb';
import type { InterviewRecap } from './InterviewRecapCard';
import { useTTSProvider } from '@/components/interview/hooks/useTTSProvider';

const SILENCE_MS = 2200;

interface Msg { role: 'user' | 'assistant'; content: string }

interface Props {
  candidate: V4Profile;
  sessionId?: string;
  topic?: string;
  onClose: (recap: InterviewRecap | null) => void;
}

const SYSTEM_DIRECTIVE = (candidate: V4Profile, topic?: string) =>
  `You are now a professional interview bot conducting a mock interview with ${candidate.first_name || 'the candidate'}${topic ? ` for ${topic}` : ''}. 
Stay strictly in interviewer mode. Ask ONE crisp question at a time. After their answer give 1 short line of feedback (max 15 words) and immediately ask the next question. 
Keep questions tailored to their background. Use a warm, confident, professional tone like a real interviewer. Avoid markdown/lists — speak naturally. 
Keep each turn under 60 words so it sounds good when spoken aloud. 
When the candidate says "end interview" or similar, summarize strengths and 2 improvement areas in under 80 words.`;

const FIRST_TURN = `Greet the candidate by name in one short sentence and ask the first interview question. Nothing else.`;

export function MockInterviewOverlay({ candidate, sessionId, topic, onClose }: Props) {
  const [phase, setPhase] = useState<'permission' | 'live'>('permission');
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [muted, setMuted] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [showTyping, setShowTyping] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [lastBotLine, setLastBotLine] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recogRef = useRef<any>(null);
  const messagesRef = useRef<Msg[]>([{ role: 'user', content: SYSTEM_DIRECTIVE(candidate, topic) }]);
  const transcriptRef = useRef<Msg[]>([]);
  const sessionIdRef = useRef<string | undefined>(sessionId);
  const startedAtRef = useRef<string | null>(null);
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const finalTextRef = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldListenRef = useRef(false);
  const submittedRef = useRef(false);

  const { speak: ttsSpeak, stopSpeaking, isSpeaking } = useTTSProvider(candidate.tenant_id || null);

  useEffect(() => {
    if (isSpeaking) setOrbState('speaking');
  }, [isSpeaking]);

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  const cleanup = useCallback(() => {
    shouldListenRef.current = false;
    clearSilenceTimer();
    try { recogRef.current?.stop?.(); } catch {}
    recogRef.current = null;
    try { stopSpeaking(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, [stopSpeaking]);

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [phase, camOn]);

  function speak(text: string) {
    if (!text) return;
    const onEnd = () => {
      setOrbState('idle');
      if (micOn) startListening();
    };
    if (mutedRef.current) {
      onEnd();
      return;
    }
    setOrbState('speaking');
    ttsSpeak(text, onEnd);
  }

  function startListening() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setShowTyping(true);
      return;
    }
    clearSilenceTimer();
    try { recogRef.current?.stop?.(); } catch {}
    finalTextRef.current = '';
    submittedRef.current = false;
    shouldListenRef.current = true;

    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;

    const armSilenceTimer = () => {
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        const text = finalTextRef.current.trim();
        if (!text) return;
        submittedRef.current = true;
        shouldListenRef.current = false;
        try { rec.stop(); } catch {}
        setLiveTranscript('');
        sendTurn(text);
      }, SILENCE_MS);
    };

    rec.onstart = () => {
      setOrbState('listening');
      setLiveTranscript('');
    };
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalTextRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      setLiveTranscript((finalTextRef.current + ' ' + interim).trim());
      armSilenceTimer();
    };
    rec.onerror = (e: any) => {
      if (e?.error === 'no-speech' || e?.error === 'aborted') return;
      setOrbState('idle');
    };
    rec.onend = () => {
      if (submittedRef.current) {
        setOrbState('idle');
        return;
      }
      if (shouldListenRef.current) {
        try { rec.start(); } catch {
          shouldListenRef.current = false;
          setOrbState('idle');
        }
      } else {
        setOrbState('idle');
      }
    };
    recogRef.current = rec;
    try { rec.start(); } catch {}
  }

  function stopListening() {
    shouldListenRef.current = false;
    clearSilenceTimer();
    try { recogRef.current?.stop?.(); } catch {}
    setOrbState('idle');
  }

  async function sendTurn(userText: string) {
    if (busy) return;
    setBusy(true);
    setOrbState('thinking');
    transcriptRef.current = [...transcriptRef.current, { role: 'user', content: userText }];
    messagesRef.current = [...messagesRef.current, { role: 'user', content: userText }];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/mentor-copilot-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          messages: messagesRef.current.map((m) => ({ role: m.role, content: m.content })),
          ephemeral: true,
        }),
      });
      if (!resp.ok || !resp.body) throw new Error('chat failed');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, idx).replace(/\r$/, '');
          buf = buf.slice(idx + 1);
          if (line.startsWith('event: session')) continue;
          if (!line.startsWith('data: ')) continue;
          const j = line.slice(6).trim();
          if (!j || j === '[DONE]') continue;
          try {
            const p = JSON.parse(j);
            if (p.sessionId) { sessionIdRef.current = p.sessionId; continue; }
            const c = p.choices?.[0]?.delta?.content;
            if (c) { acc += c; setLastBotLine(acc); }
          } catch {}
        }
      }
      const finalBot = acc.trim() || '…';
      transcriptRef.current = [...transcriptRef.current, { role: 'assistant', content: finalBot }];
      messagesRef.current = [...messagesRef.current, { role: 'assistant', content: finalBot }];
      speak(stripForSpeech(finalBot));
    } catch (e) {
      setLastBotLine('Sorry, I lost connection. Try again or close the interview.');
      setOrbState('idle');
    } finally {
      setBusy(false);
    }
  }

  async function beginInterview() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      messagesRef.current = [...messagesRef.current, { role: 'user', content: FIRST_TURN }];
      setPhase('live');
    } catch (e: any) {
      setError(e?.message || 'Camera/microphone permission denied.');
    }
  }

  async function sendInitial() {
    setBusy(true);
    setOrbState('thinking');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/mentor-copilot-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          messages: messagesRef.current.map((m) => ({ role: m.role, content: m.content })),
          ephemeral: true,
        }),
      });
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '', acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, idx).replace(/\r$/, '');
          buf = buf.slice(idx + 1);
          if (!line.startsWith('data: ')) continue;
          const j = line.slice(6).trim();
          if (!j || j === '[DONE]') continue;
          try {
            const p = JSON.parse(j);
            if (p.sessionId) { sessionIdRef.current = p.sessionId; continue; }
            const c = p.choices?.[0]?.delta?.content;
            if (c) { acc += c; setLastBotLine(acc); }
          } catch {}
        }
      }
      const finalBot = acc.trim() || 'Hello, shall we begin?';
      if (!startedAtRef.current) startedAtRef.current = new Date().toISOString();
      transcriptRef.current = [...transcriptRef.current, { role: 'assistant', content: finalBot }];
      messagesRef.current = [...messagesRef.current, { role: 'assistant', content: finalBot }];
      speak(stripForSpeech(finalBot));
    } catch {
      setLastBotLine('Could not start the interview. Please try again.');
      setOrbState('idle');
    } finally {
      setBusy(false);
    }
  }

  const startedRef = useRef(false);
  useEffect(() => {
    if (phase === 'live' && !startedRef.current) {
      startedRef.current = true;
      sendInitial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function toggleCam() {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (track) { track.enabled = !track.enabled; setCamOn(track.enabled); }
  }

  function toggleMic() {
    if (micOn) { stopListening(); setMicOn(false); }
    else { setMicOn(true); startListening(); }
  }

  const closingRef = useRef(false);
  async function handleClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    try { recogRef.current?.stop?.(); } catch {}
    try { stopSpeaking(); } catch {}
    setOrbState('thinking');

    const transcript = transcriptRef.current.slice();
    const startedAt = startedAtRef.current || new Date().toISOString();
    const endedAt = new Date().toISOString();
    const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const questionCount = transcript.filter((m) => m.role === 'assistant').length;
    const answerCount = transcript.filter((m) => m.role === 'user').length;

    if (transcript.length === 0) {
      cleanup();
      onClose(null);
      return;
    }

    const SHORT_THRESHOLD_MS = 5 * 60 * 1000;
    const isShort = answerCount < 3 || durationMs < SHORT_THRESHOLD_MS;

    let feedback = '';
    if (isShort) {
      feedback =
`**Session too short for deep feedback** ⏱️

You only answered **${answerCount} question${answerCount === 1 ? '' : 's'}** in **${Math.max(1, Math.round(durationMs / 60000))} min**.

To get meaningful insights, please spend **15–20 minutes** and answer at least **4–5 questions** in one go.

✅ Practice more whenever you feel comfortable — try a fresh round, take a breath between answers, and aim for 1–2 minute responses.`;
    } else {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const sys =
`You are an expert interview coach. Analyze the mock interview transcript below and produce concise, structured feedback in markdown.

Be honest and specific. Output exactly these sections, each as short bullets (max 2 lines per bullet), total under 220 words:

**🧠 Technical gaps** — concepts the candidate struggled with or skipped (cite the question briefly).
**💬 Non-technical gaps** — clarity, structure, brevity, confidence, filler words, energy.
**🤖 Comfort with the bot** — were they comfortable? Any signs of runtime issues like misheard speech-to-text (look for garbled tech terms, "what?", "can you repeat", mismatched answers, very short answers)?
**🛠️ How to fix it next time** — practical tips: speak slower on tech terms, spell out acronyms (e.g. "A-P-I"), pause between sentences, use the "Type instead" mode for tricky words, repeat the question to confirm.
**🎯 Next steps** — 2 concrete actions for their next attempt.

Do NOT praise generically. Do NOT include scores. Do NOT add a closing line. No greeting.`;

        const userPayload =
`Candidate: ${candidate.first_name || 'Candidate'}${topic ? ` · Topic: ${topic}` : ''}
Duration: ${Math.round(durationMs / 60000)} min · Questions asked: ${questionCount} · Answers given: ${answerCount}

Transcript:
${transcript.map((m) => `${m.role === 'assistant' ? 'INTERVIEWER' : 'CANDIDATE'}: ${m.content}`).join('\n\n')}`;

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/mentor-copilot-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
          body: JSON.stringify({
            messages: [
              { role: 'user', content: sys },
              { role: 'user', content: userPayload },
            ],
            ephemeral: true,
          }),
        });
        if (resp.ok && resp.body) {
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buf = '', acc = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf('\n')) !== -1) {
              const line = buf.slice(0, idx).replace(/\r$/, '');
              buf = buf.slice(idx + 1);
              if (!line.startsWith('data: ')) continue;
              const j = line.slice(6).trim();
              if (!j || j === '[DONE]') continue;
              try {
                const p = JSON.parse(j);
                const c = p.choices?.[0]?.delta?.content;
                if (c) acc += c;
              } catch {}
            }
          }
          feedback = acc.trim();
        }
      } catch {}

      if (!feedback) {
        feedback =
`**Couldn't generate detailed feedback right now** ⚠️

You completed **${answerCount} answers** in **${Math.round(durationMs / 60000)} min** — nice effort.

Try again in a moment, or run another round to get fresh insights.`;
      }
    }

    const recap: InterviewRecap = {
      feedback,
      transcript,
      durationMs,
      questionCount,
      answerCount,
      startedAt,
      endedAt,
      short: isShort,
    };

    cleanup();
    onClose(recap);
  }

  function handleTypedSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = typedInput.trim();
    if (!text) return;
    setTypedInput('');
    sendTurn(text);
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl text-white animate-fade-in">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/40 via-slate-950 to-fuchsia-950/30" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4 z-10">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Mock Interview · powered by AlphaMentor
        </div>
        <button
          onClick={handleClose}
          className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          aria-label="Close interview"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative h-full w-full flex flex-col items-center justify-center px-6">
        {phase === 'permission' ? (
          <div className="max-w-md text-center space-y-6">
            <AIOrb state="idle" size={200} />
            <div>
              <h2 className="text-2xl font-semibold mb-2">Ready for your mock interview?</h2>
              <p className="text-white/70 text-sm">
                I'll act as your interviewer. We'll use your camera and mic for a realistic experience.
                Nothing is recorded or uploaded — your privacy stays intact.
              </p>
            </div>
            {error && <div className="text-rose-300 text-sm">{error}</div>}
            <div className="flex items-center justify-center gap-3">
              <Button onClick={beginInterview} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 px-6">
                Start Interview
              </Button>
              <Button variant="ghost" onClick={handleClose} className="text-white/70 hover:text-white hover:bg-white/10">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <AIOrb state={orbState} size={260} />

            <div className="mt-10 max-w-2xl w-full text-center min-h-[80px] space-y-2">
              {busy && orbState === 'thinking' && (
                <div className="text-white/50 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> thinking…
                </div>
              )}
              {lastBotLine && (
                <p className="text-white/90 text-lg leading-relaxed">{lastBotLine}</p>
              )}
              {liveTranscript && (
                <p className="text-emerald-300/90 text-sm italic">"{liveTranscript}"</p>
              )}
              <div className="text-[10px] uppercase tracking-widest text-white/40 pt-2">
                {orbState === 'listening' && 'Listening — speak now'}
                {orbState === 'speaking' && 'Interviewer speaking'}
                {orbState === 'thinking' && 'Processing'}
                {orbState === 'idle' && (micOn ? 'Tap mic to answer' : 'Mic off — type your answer below')}
              </div>
            </div>
          </>
        )}
      </div>

      {phase === 'live' && (
        <div className="absolute bottom-28 right-6 z-10">
          <div className="relative h-40 w-40 rounded-full overflow-hidden ring-2 ring-white/20 shadow-2xl bg-slate-900">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn('h-full w-full object-cover', !camOn && 'opacity-0', '[transform:scaleX(-1)]')}
            />
            {!camOn && (
              <div className="absolute inset-0 flex items-center justify-center text-white/40 text-xs">
                Camera off
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'live' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 shadow-2xl">
            <ControlBtn active={micOn} onClick={toggleMic} title={micOn ? 'Mute mic' : 'Unmute mic'}>
              {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </ControlBtn>
            <ControlBtn active={camOn} onClick={toggleCam} title={camOn ? 'Turn camera off' : 'Turn camera on'}>
              {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </ControlBtn>
            <ControlBtn active={!muted} onClick={() => { setMuted((m) => !m); if (!muted) stopSpeaking(); }} title={muted ? 'Unmute interviewer' : 'Mute interviewer'}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </ControlBtn>
            <ControlBtn active={showTyping} onClick={() => setShowTyping((s) => !s)} title="Type instead">
              <Keyboard className="h-4 w-4" />
            </ControlBtn>
            <button
              onClick={handleClose}
              className="ml-1 px-4 h-10 rounded-full bg-rose-500/90 hover:bg-rose-500 text-white text-sm font-medium flex items-center gap-2"
            >
              <X className="h-4 w-4" /> End
            </button>
          </div>

          {showTyping && (
            <form onSubmit={handleTypedSubmit} className="mt-3 flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/15">
              <input
                autoFocus
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                placeholder="Type your answer…"
                className="bg-transparent outline-none text-sm text-white placeholder:text-white/40 flex-1 px-2 min-w-[280px]"
              />
              <button type="submit" disabled={busy || !typedInput.trim()} className="h-8 w-8 rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 flex items-center justify-center">
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function ControlBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'h-10 w-10 rounded-full flex items-center justify-center transition',
        active ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-white/5 hover:bg-white/15 text-white/60'
      )}
    >
      {children}
    </button>
  );
}

function stripForSpeech(s: string) {
  return s
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
