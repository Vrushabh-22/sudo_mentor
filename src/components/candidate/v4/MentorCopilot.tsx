import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { V4Profile } from '@/pages/CandidatePortalV4';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Sparkles, Loader2, Mic, MessageSquare, Star, Brain, Briefcase, HelpCircle, X } from 'lucide-react';
import { SUPABASE_URL } from '@/integrations/supabase/client';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { MessageRenderer } from './chat/MessageRenderer';
import { LearningPathView } from './LearningPathView';
import { MockInterviewOverlay } from './MockInterviewOverlay';
import { InterviewRecapCard, type InterviewRecap } from './InterviewRecapCard';
import { missingEssentials } from '@/lib/profileCompleteness';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  kind?: 'interview_recap';
  recap?: InterviewRecap;
}

interface Props { candidate: V4Profile; onProfileChanged: () => void; onOpenProfile?: () => void }

const NUGGETS: Array<{ label: string; icon: any; prompt: string; mode?: 'interview' }> = [
  { label: 'Start mock interview', icon: Mic, prompt: 'INTERVIEW_START', mode: 'interview' },
  { label: 'Tell me about yourself', icon: MessageSquare, prompt: 'Coach me on the "Tell me about yourself" answer. Give a crisp 60-second structure tailored to my profile, with a sample answer I can adapt.' },
  { label: 'STAR framework', icon: Star, prompt: 'Explain the STAR framework for behavioral interviews with one fully worked example relevant to my background.' },
  { label: 'Common HR questions', icon: Brain, prompt: 'Give me the top 10 most common HR interview questions with a 2-line answering tip for each.' },
  { label: 'Salary negotiation', icon: Briefcase, prompt: 'Share practical salary negotiation tips for a fresher / early-career candidate, including what to say and what to avoid.' },
  { label: 'Questions to ask', icon: HelpCircle, prompt: 'Suggest 8 smart questions I can ask the interviewer at the end of the round, grouped by purpose.' },
];


const PAGE_SIZE = 20;
const CACHE_PREFIX = 'mentor_chat_v1:';
const CACHE_MAX = 80;

function cacheKey(candidateId: string) { return `${CACHE_PREFIX}${candidateId}`; }

function readCache(candidateId: string): { sessionId?: string; messages: Msg[] } | null {
  try {
    const raw = localStorage.getItem(cacheKey(candidateId));
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.messages)) return null;
    return p;
  } catch { return null; }
}

function writeCache(candidateId: string, sessionId: string | undefined, messages: Msg[]) {
  try {
    const trimmed = messages.slice(-CACHE_MAX);
    localStorage.setItem(cacheKey(candidateId), JSON.stringify({ sessionId, messages: trimmed }));
  } catch {}
}

function formatDayLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, yest)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function isInterviewInternal(msg: { role: string; content: string }): boolean {
  const c = (msg?.content || '').trim();
  if (!c) return false;
  if (c.startsWith('You are now a professional interview bot')) return true;
  if (c.startsWith('Greet the candidate by name in one short sentence')) return true;
  if (c.startsWith('You are an expert interview coach. Analyze the mock interview transcript')) return true;
  if (/^Candidate:.*\nDuration:.*Questions asked:/s.test(c)) return true;
  if (/^(INTERVIEWER|CANDIDATE):\s/m.test(c) && /\n\n(INTERVIEWER|CANDIDATE):/.test(c)) return true;
  if (c.includes('SYSTEM_DIRECTIVE') || c.includes('FIRST_TURN')) return true;
  return false;
}

function buildGreeting(candidate: V4Profile): Msg {
  const missing = missingEssentials(candidate);
  const content = missing.length === 0
    ? `Hey ${candidate.first_name || 'there'}! I'm your AlphaMentor. Ready to level up your placement game? Ask me about skills to learn, mock interviews, or a personalised learning path.`
    : `Hi ${candidate.first_name || 'there'}! I'm AlphaMentor 🎓. Quick setup so I can guide you better — fill the form below 👇\n[ACTION:profile_form:fields=${missing.join(',')}]`;

  return {
    id: 'mentor-greeting',
    role: 'assistant',
    content,
  };
}

export function MentorCopilot({ candidate, onProfileChanged }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [openPathId, setOpenPathId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [interviewerMode, setInterviewerMode] = useState(false);
  const [showInterviewOverlay, setShowInterviewOverlay] = useState(false);
  const [interviewTopic, setInterviewTopic] = useState<string | undefined>();
  const [weakTopics, setWeakTopics] = useState<Array<{ topic: string; hits: number }>>([]);
  const [streakDays, setStreakDays] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(false);
  const prependScrollRef = useRef<number | null>(null);
  const didInitialBottomScrollRef = useRef(false);


  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      const cached = readCache(candidate.id);
      if (cached && cached.messages.length > 0) {
        const clean = cached.messages.filter((m) => !isInterviewInternal(m));
        if (clean.length !== cached.messages.length) {
          writeCache(candidate.id, cached.sessionId, clean);
        }
        if (clean.length > 0) {
          setMessages(clean);
          setSessionId(cached.sessionId);
          setInitialLoading(false);
          shouldStickToBottomRef.current = true;
        } else {
          setInitialLoading(true);
        }
      } else {
        setInitialLoading(true);
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('no auth');
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/mentor-copilot-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'history', limit: PAGE_SIZE }),
        });

        if (!resp.ok) throw new Error('Could not load mentor history');
        const data = await resp.json();
        if (cancelled) return;

        setSessionId(data?.sessionId || undefined);
        const loadedMessages = (Array.isArray(data?.messages)
          ? data.messages.map((m: any) => ({
              id: m.id || crypto.randomUUID(),
              role: m.role,
              content: m.content || '',
              createdAt: m.created_at,
            }))
          : []
        ).filter((m: Msg) => !isInterviewInternal(m));

        if (loadedMessages.length > 0) {
          setMessages(loadedMessages);
          setHasOlder(!!data?.hasMore);
          writeCache(candidate.id, data?.sessionId || undefined, loadedMessages);
          shouldStickToBottomRef.current = true;
        } else if (!cached || cached.messages.length === 0) {
          setMessages([buildGreeting(candidate)]);
          setHasOlder(false);
        }
      } catch {
        if (!cancelled && (!cached || cached.messages.length === 0)) {
          setMessages([buildGreeting(candidate)]);
          setHasOlder(false);
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }

    loadHistory();

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const r = await fetch(`${SUPABASE_URL}/functions/v1/mentor-copilot-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'memory' }),
        });
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
        const mem = d?.memory || {};
        setWeakTopics(Array.isArray(mem.weak_topics) ? mem.weak_topics : []);
        setStreakDays(Number(mem.streak_days) || 0);
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [candidate.id]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    if (prependScrollRef.current !== null) {
      const previousHeight = prependScrollRef.current;
      const delta = container.scrollHeight - previousHeight;
      container.scrollTop += delta;
      prependScrollRef.current = null;
      return;
    }

    if (shouldStickToBottomRef.current) {
      const behavior = didInitialBottomScrollRef.current ? 'smooth' : 'auto';
      container.scrollTo({ top: container.scrollHeight, behavior });
      didInitialBottomScrollRef.current = true;
      shouldStickToBottomRef.current = false;
    }
  }, [messages]);

  useEffect(() => {
    if (streaming) return;
    if (!candidate?.id) return;
    if (messages.length === 0) return;
    if (messages.length === 1 && messages[0].id === 'mentor-greeting') return;
    writeCache(candidate.id, sessionId, messages);
  }, [messages, sessionId, streaming, candidate.id]);

  async function loadOlderMessages() {
    if (loadingOlder || !hasOlder) return;
    const oldest = messages.find((message) => message.createdAt);
    if (!oldest?.createdAt) return;

    const container = scrollRef.current;
    if (container) prependScrollRef.current = container.scrollHeight;

    setLoadingOlder(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/mentor-copilot-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          action: 'older',
          beforeCreatedAt: oldest.createdAt,
          limit: PAGE_SIZE,
        }),
      });

      if (!resp.ok) throw new Error('Could not load older mentor messages');
      const data = await resp.json();
      const olderMessages = (Array.isArray(data?.messages)
        ? data.messages.map((m: any) => ({
            id: m.id || crypto.randomUUID(),
            role: m.role,
            content: m.content || '',
            createdAt: m.created_at,
          }))
        : []
      ).filter((m: Msg) => !isInterviewInternal(m));

      setSessionId((prev) => prev || data?.sessionId || undefined);
      setHasOlder(!!data?.hasMore);
      if (olderMessages.length > 0) {
        setMessages((prev) => [...olderMessages, ...prev]);
      } else {
        prependScrollRef.current = null;
      }
    } catch {
      prependScrollRef.current = null;
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(text: string) {
    if (!text.trim() || streaming) return;

    const userMessage: Msg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const assistantPlaceholderId = crypto.randomUUID();

    const next = [...messages, userMessage];
    setMessages([...next, { id: assistantPlaceholderId, role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);
    shouldStickToBottomRef.current = true;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/mentor-copilot-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          messages: next.map((message) => ({ role: message.role, content: message.content })),
          sessionId,
        }),
      });
      if (!resp.ok || !resp.body) throw new Error('Chat failed');
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
            if (p.sessionId) {
              setSessionId(p.sessionId);
              continue;
            }
            const c = p.choices?.[0]?.delta?.content;
            if (c) {
              acc += c;
              shouldStickToBottomRef.current = true;
              setMessages((prev) => prev.map((m) => (m.id === assistantPlaceholderId ? { ...m, content: acc } : m)));
            }
          } catch {}
        }
      }
      const finishedAt = new Date().toISOString();
      setMessages((prev) => prev.map((m) => (m.id === assistantPlaceholderId ? { ...m, createdAt: finishedAt } : m)));
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === assistantPlaceholderId ? { ...m, content: '😔 Sorry, I had trouble responding. Please try again.', createdAt: new Date().toISOString() } : m)));
    } finally {
      setStreaming(false);
    }
  }

  function handleProfileSaved() {
    onProfileChanged();
    send('I just completed my profile. What should I work on next?');
  }

  if (openPathId) {
    return (
      <div className="bg-white rounded-2xl border border-violet-100 p-3">
        <LearningPathView pathId={openPathId} onBack={() => setOpenPathId(null)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] lg:h-[calc(100vh-120px)] bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-violet-50 to-fuchsia-50 flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-semibold text-sm">AlphaMentor</div>
          <div className="text-[10px] text-muted-foreground">Your personal placement coach</div>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          if (event.currentTarget.scrollTop <= 80) loadOlderMessages();
        }}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {initialLoading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your mentor chat…
          </div>
        )}

        {!initialLoading && loadingOlder && (
          <div className="flex items-center justify-center py-2 text-xs text-muted-foreground gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading older messages…
          </div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const dayLabel = m.createdAt ? formatDayLabel(m.createdAt) : '';
          const prevDayLabel = prev?.createdAt ? formatDayLabel(prev.createdAt) : '';
          const showDay = !!dayLabel && dayLabel !== prevDayLabel;
          return (
            <div key={m.id}>
              {showDay && (
                <div className="flex justify-center my-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">
                    {dayLabel}
                  </span>
                </div>
              )}
              {m.kind === 'interview_recap' && m.recap ? (
                <div className="my-1">
                  <InterviewRecapCard recap={m.recap} candidate={candidate} />
                  {m.createdAt && (
                    <div className="mt-1 text-[10px] text-muted-foreground pl-1">{formatTime(m.createdAt)}</div>
                  )}
                </div>
              ) : (
                <div className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                    m.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : 'bg-slate-50 text-slate-800 rounded-bl-sm border border-slate-100'
                  )}>
                    {m.role === 'assistant' ? (
                      m.content
                        ? <MessageRenderer text={m.content} candidate={candidate} onProfilePatched={handleProfileSaved} onOpenPath={(id) => setOpenPathId(id)} onStartMockInterview={() => { setInterviewTopic(undefined); setShowInterviewOverlay(true); }} />
                        : <div className="text-muted-foreground">...</div>
                    ) : (
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    )}
                    {m.createdAt && (
                      <div className={cn(
                        'mt-1 text-[10px]',
                        m.role === 'user' ? 'text-violet-100/80 text-right' : 'text-muted-foreground'
                      )}>
                        {formatTime(m.createdAt)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> thinking…</div>
        )}
      </div>

      <div className="px-3 pt-2 pb-2 border-t bg-gradient-to-b from-violet-50/40 to-white">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles className="h-3 w-3 text-violet-500" />
          <span className="text-[10px] font-medium uppercase tracking-wide text-violet-600">
            {interviewerMode ? 'Interviewer mode' : 'Interview prep'}
          </span>
          {interviewerMode && (
            <button
              type="button"
              onClick={() => { setInterviewerMode(false); send('End the mock interview now and give me overall feedback with strengths and areas to improve.'); }}
              disabled={streaming}
              className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100 disabled:opacity-50 flex items-center gap-1"
            >
              <X className="h-3 w-3" /> End interview
            </button>
          )}
          {streakDays >= 2 && (
            <span className="ml-auto text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              🔥 {streakDays}-day streak
            </span>
          )}
        </div>
        {weakTopics.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1.5 -mx-1 px-1 scrollbar-thin">
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-rose-600 font-medium self-center">Fix these:</span>
            {weakTopics.slice(0, 6).map((w) => (
              <button
                key={w.topic}
                type="button"
                disabled={streaming}
                onClick={() => send(`Let's fix my ${w.topic} once and for all today. Walk me through it step by step.`)}
                className="shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                {w.topic} <span className="text-rose-400">×{w.hits}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {NUGGETS.map((n) => (
            <button
              key={n.label}
              type="button"
              onClick={() => {
                if (n.mode === 'interview') {
                  const topic = input.trim() || undefined;
                  setInput('');
                  setInterviewTopic(topic);
                  setShowInterviewOverlay(true);
                } else {
                  send(n.prompt);
                }
              }}
              disabled={streaming}
              className={cn(
                'shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-colors disabled:opacity-50',
                n.mode === 'interview'
                  ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-transparent hover:opacity-90 shadow-sm'
                  : 'bg-white text-violet-700 border-violet-200 hover:bg-violet-50'
              )}
            >
              <n.icon className="h-3 w-3" /> {n.label}
            </button>
          ))}
        </div>
      </div>


      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="p-3 border-t bg-white flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask your mentor anything…"
          rows={1}
          className="min-h-10 max-h-32 resize-none text-sm"
        />
        <Button type="submit" disabled={streaming || !input.trim() || initialLoading} size="icon" className="bg-violet-600 hover:bg-violet-700 shrink-0">
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      {showInterviewOverlay && (
        <MockInterviewOverlay
          candidate={candidate}
          sessionId={sessionId}
          topic={interviewTopic}
          onClose={(recap) => {
            setShowInterviewOverlay(false);
            if (!recap) return;
            const recapMsg: Msg = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: '',
              createdAt: new Date().toISOString(),
              kind: 'interview_recap',
              recap,
            };
            setMessages((prev) => [...prev, recapMsg]);
            shouldStickToBottomRef.current = true;
          }}
        />
      )}
    </div>
  );
}
