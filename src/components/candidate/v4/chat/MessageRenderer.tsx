import { ProfileFormCard } from './ProfileFormCard';
import { LPSuggestionCard } from './LPSuggestionCard';
import { V4Profile } from '@/pages/CandidatePortalV4';
import { Mic } from 'lucide-react';

interface Props {
  text: string;
  candidate: V4Profile;
  onProfilePatched: (patch: Record<string, any>) => void;
  onOpenPath: (pathId: string) => void;
  onStartMockInterview?: () => void;
}

function parseActions(text: string) {
  const re = /\[ACTION:([a-z_]+)((?::[a-zA-Z_][a-zA-Z0-9_]*=[^\]:]+)*)\]/g;
  const parts: Array<{ kind: 'text' | 'action'; content: any }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', content: text.slice(last, m.index) });
    const type = m[1];
    const rest = m[2] || '';
    const params: Record<string, string> = {};
    rest.split(':').filter(Boolean).forEach((pair) => {
      const [k, ...v] = pair.split('=');
      if (k) params[k] = v.join('=');
    });
    parts.push({ kind: 'action', content: { type, params } });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', content: text.slice(last) });
  return parts;
}

function renderText(t: string) {
  const lines = t.split('\n');
  const fmtInline = (s: string) =>
    s
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-violet-50 text-violet-700 text-[12px]">$1</code>');
  return (
    <div className="leading-relaxed space-y-1">
      {lines.map((line, i) => {
        const h3 = line.match(/^\s*###\s+(.+)/);
        if (h3) return <div key={i} className="text-[15px] font-semibold text-slate-900 mt-2" dangerouslySetInnerHTML={{ __html: fmtInline(h3[1]) }} />;
        const h2 = line.match(/^\s*##\s+(.+)/);
        if (h2) return <div key={i} className="text-base font-bold text-slate-900 mt-2" dangerouslySetInnerHTML={{ __html: fmtInline(h2[1]) }} />;
        const h1 = line.match(/^\s*#\s+(.+)/);
        if (h1) return <div key={i} className="text-lg font-bold text-slate-900 mt-2" dangerouslySetInnerHTML={{ __html: fmtInline(h1[1]) }} />;
        const bullet = line.match(/^\s*[-*]\s+(.+)/);
        if (bullet) {
          return <div key={i} className="flex gap-2"><span className="text-violet-600">•</span><span dangerouslySetInnerHTML={{ __html: fmtInline(bullet[1]) }} /></div>;
        }
        const num = line.match(/^\s*(\d+)\.\s+(.+)/);
        if (num) {
          return <div key={i} className="flex gap-2"><span className="text-violet-600 font-medium">{num[1]}.</span><span dangerouslySetInnerHTML={{ __html: fmtInline(num[2]) }} /></div>;
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return <div key={i} dangerouslySetInnerHTML={{ __html: fmtInline(line) }} />;
      })}
    </div>
  );
}

export function MessageRenderer({ text, candidate, onProfilePatched, onOpenPath, onStartMockInterview }: Props) {
  const parts = parseActions(text);
  return (
    <div>
      {parts.map((p, i) => {
        if (p.kind === 'text') return <div key={i}>{renderText(p.content as string)}</div>;
        const a = p.content as { type: string; params: Record<string, string> };
        if (a.type === 'mock_interview') {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onStartMockInterview?.()}
              className="mt-2 inline-flex items-center gap-2 text-xs font-medium bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-full px-3.5 py-1.5 shadow-sm hover:opacity-90"
            >
              <Mic className="h-3 w-3" /> Start mock interview
            </button>
          );
        }
        if (a.type === 'profile_form') {
          const fields = (a.params.fields || '').split(',').map((s) => s.trim()).filter(Boolean);
          return <ProfileFormCard key={i} fields={fields} initial={candidate} onSubmitted={onProfilePatched} />;
        }
        if (a.type === 'learning_path') {
          const skill = a.params.skill || '';
          const tags = (a.params.tags || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
          if (!skill) return null;
          return <LPSuggestionCard key={i} skill={decodeURIComponent(skill)} tags={tags} onOpenPath={onOpenPath} />;
        }
        if (a.type === 'practice') {
          return (
            <div key={i} className="mt-2 inline-flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full px-3 py-1.5">
              💡 Try a practice quiz on {a.params.domain || 'this topic'} (in the Practice tab)
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
