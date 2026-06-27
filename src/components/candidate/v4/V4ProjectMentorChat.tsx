import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { invokeV4 } from '@/lib/candidatePortalV4Client';
import { Sparkles, Send, Loader2, Bot, Maximize2, Minimize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface Msg { id?: string; role: 'user' | 'assistant'; content: string; created_at?: string }

const SUGGESTIONS = [
  'Explain the problem like I am a beginner',
  'Suggest an architecture & tech choices',
  'What edge cases should I cover?',
  'Give me a sample DB schema',
  'How should I structure the repo?',
];

const PAGE_SIZE = 20;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function renderInline(s: string) {
  let out = escapeHtml(s);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="underline underline-offset-2">$1</a>');
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-100 text-slate-800 text-[12px] font-mono">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return out;
}
function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: Array<{ type: 'p' | 'ul' | 'ol' | 'h'; level?: number; items?: string[]; html?: string }> = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { blocks.push({ type: 'h', level: h[1].length, html: renderInline(h[2]) }); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^\s*[-*]\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(renderInline(m[1])); i++;
      }
      blocks.push({ type: 'ul', items }); continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^\s*\d+\.\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(renderInline(m[1])); i++;
      }
      blocks.push({ type: 'ol', items }); continue;
    }
    if (line.trim() === '') { i++; continue; }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3})\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    blocks.push({ type: 'p', html: buf.map(renderInline).join('<br />') });
  }
  return (
    <div className="text-sm leading-relaxed space-y-2">
      {blocks.map((b, idx) => {
        if (b.type === 'h') {
          const cls = b.level === 1 ? 'text-base font-bold' : b.level === 2 ? 'text-sm font-bold' : 'text-sm font-semibold';
          return <div key={idx} className={cls} dangerouslySetInnerHTML={{ __html: b.html! }} />;
        }
        if (b.type === 'ul') return <ul key={idx} className="list-disc pl-5 space-y-1">{b.items!.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: it }} />)}</ul>;
        if (b.type === 'ol') return <ol key={idx} className="list-decimal pl-5 space-y-1">{b.items!.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: it }} />)}</ol>;
        return <p key={idx} dangerouslySetInnerHTML={{ __html: b.html! }} />;
      })}
    </div>
  );
}

export function V4ProjectMentorChat({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const { toast } = useToast();
  const greeting: Msg = { role: 'assistant', content: `Hi! I'm your mentor for **${projectTitle}**. Ask me anything about the problem, design, code, or tools. Where would you like to start?` };
  const [messages, setMessages] = useState<Msg[]>([greeting]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHydrated(false);
      const { data, error } = await invokeV4({ action: 'mentor_history', project_id: projectId, limit: PAGE_SIZE });
      if (cancelled) return;
      if (error || (data as any)?.error) {
        setMessages([greeting]);
        setHasMore(false);
      } else {
        const rows: Msg[] = ((data as any).messages || []).map((r: any) => ({ id: r.id, role: r.role, content: r.content, created_at: r.created_at }));
        setMessages(rows.length ? rows : [greeting]);
        setHasMore(!!(data as any).has_more);
      }
      setHydrated(true);
      stickToBottomRef.current = true;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!hydrated) return;
    if (stickToBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading, hydrated]);

  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [fullscreen]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore) return;
    const oldest = messages.find((m) => m.created_at);
    if (!oldest?.created_at) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight || 0;
    const prevTop = el?.scrollTop || 0;
    const { data, error } = await invokeV4({ action: 'mentor_history', project_id: projectId, before: oldest.created_at, limit: PAGE_SIZE });
    setLoadingOlder(false);
    if (error || (data as any)?.error) return;
    const older: Msg[] = ((data as any).messages || []).map((r: any) => ({ id: r.id, role: r.role, content: r.content, created_at: r.created_at }));
    setHasMore(!!(data as any).has_more);
    if (older.length) {
      setMessages((prev) => [...older, ...prev]);
      requestAnimationFrame(() => {
        const el2 = scrollRef.current;
        if (el2) el2.scrollTop = prevTop + (el2.scrollHeight - prevHeight);
      });
    }
  }, [hasMore, loadingOlder, messages, projectId]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && hasMore && !loadingOlder) {
      loadOlder();
    }
  }, [hasMore, loadingOlder, loadOlder]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    const optimistic: Msg = { role: 'user', content: t };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');
    setLoading(true);
    stickToBottomRef.current = true;
    const { data, error } = await invokeV4({ action: 'mentor_chat', project_id: projectId, user_message: t });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Mentor unavailable', description: (data as any)?.error || error?.message, variant: 'destructive' });
      return;
    }
    const d: any = data;
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'user' && !next[i].id) { next[i] = { ...next[i], id: d.user_id }; break; }
      }
      next.push({ id: d.assistant_id, role: 'assistant', content: d.reply, created_at: d.created_at });
      return next;
    });
  };

  const shellCls = fullscreen
    ? 'fixed inset-0 z-[100] bg-white flex flex-col'
    : 'flex flex-col h-[520px] bg-white rounded-2xl border border-slate-200 overflow-hidden';

  const content = (
    <div className={shellCls}>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 text-slate-900 border-b border-violet-100">
        <div className="h-7 w-7 rounded-full bg-white ring-1 ring-violet-200 flex items-center justify-center"><Bot className="h-4 w-4 text-violet-600" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">Project Mentor</div>
          <div className="text-[10px] text-slate-500 truncate">Ask anything about this project</div>
        </div>
        <Sparkles className="h-4 w-4 text-violet-600" />
        <button
          onClick={() => setFullscreen((v) => !v)}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen mentor'}
          className="ml-1 h-7 w-7 rounded-md hover:bg-white/70 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"
        >
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        {fullscreen && (
          <button onClick={() => setFullscreen(false)} aria-label="Close" className="h-7 w-7 rounded-md hover:bg-white/70 flex items-center justify-center text-slate-600 hover:text-slate-900">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50/40">
        <div className={fullscreen ? 'mx-auto w-full max-w-3xl space-y-3' : 'space-y-3'}>
          {loadingOlder && (
            <div className="flex justify-center py-1 text-[11px] text-slate-500 gap-1.5 items-center">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading older…
            </div>
          )}
          {!loadingOlder && hasMore && (
            <div className="flex justify-center py-1">
              <button onClick={loadOlder} className="text-[11px] text-slate-500 hover:text-slate-700 underline underline-offset-2">Load older messages</button>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={m.id || i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                m.role === 'user'
                  ? 'bg-violet-600 text-white rounded-br-md [&_strong]:text-white [&_code]:bg-violet-500 [&_code]:text-white [&_a]:text-white'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm [&_a]:text-violet-600'
              }`}>
                <MarkdownLite text={m.content} />
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3 py-2 text-sm flex items-center gap-2 text-slate-500 shadow-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            </div>
          )}
        </div>
      </div>

      {hydrated && messages.length <= 1 && (
        <div className="px-3 py-2 flex flex-wrap gap-1.5 bg-white border-t border-slate-100">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="p-2 sm:p-3 border-t border-slate-200 bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className={`${fullscreen ? 'mx-auto w-full max-w-3xl' : ''} flex gap-2 items-end`}>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about this project…"
            rows={1}
            className="min-h-[40px] max-h-[140px] resize-none text-sm flex-1"
          />
          <Button onClick={() => send(input)} disabled={loading || !input.trim()} size="icon" className="bg-violet-600 hover:bg-violet-700 text-white shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  if (fullscreen && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
}
