import { useMemo, useState } from 'react';
import { CalendarDays, FileText, Pin, Plus, Search, StickyNote } from 'lucide-react';
import { Note } from './useNotes';

interface Props {
  pinned: Note[];
  pages: Note[];
  dailies: Note[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreatePage: () => void;
  onOpenDaily: (dateISO: string) => void;
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function NotesSidebar({ pinned, pages, dailies, activeId, onSelect, onCreatePage, onOpenDaily }: Props) {
  const [q, setQ] = useState('');
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const all = useMemo(() => [...pinned, ...pages, ...dailies], [pinned, pages, dailies]);
  const filtered = useMemo(() => {
    if (!q.trim()) return null;
    const needle = q.toLowerCase();
    return all.filter(n => n.title.toLowerCase().includes(needle));
  }, [all, q]);

  const Row = ({ n }: { n: Note }) => (
    <button
      onClick={() => onSelect(n.id)}
      className={`w-full text-left px-2 py-1.5 rounded-md flex items-center gap-2 text-sm truncate ${
        activeId === n.id ? 'bg-violet-100 text-violet-900' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      <span className="text-base flex-shrink-0">{n.icon || (n.kind === 'daily' ? '🗓️' : '📝')}</span>
      <span className="truncate">{n.title}</span>
    </button>
  );

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-50/80 border-r border-slate-200 flex flex-col h-full">
      <div className="px-3 py-3 border-b border-slate-200 flex items-center gap-2">
        <StickyNote className="h-4 w-4 text-violet-600" />
        <span className="font-semibold text-sm text-slate-800">Notes</span>
        <button
          onClick={onCreatePage}
          className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-600"
          title="New page"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-slate-200">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notes…"
            className="w-full text-xs pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-violet-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {filtered ? (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 px-2 mb-1">Results</div>
            {filtered.length === 0 ? (
              <div className="text-xs text-slate-400 px-2 py-2">No matches.</div>
            ) : filtered.map(n => <Row key={n.id} n={n} />)}
          </div>
        ) : (
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 px-2 mb-1 flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> Daily journal
              </div>
              <button
                onClick={() => onOpenDaily(today)}
                className="w-full text-left px-2 py-1.5 rounded-md text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <span>🗓️</span> Today
              </button>
              {dailies.slice(0, 7).map(n => (
                <Row key={n.id} n={{ ...n, title: fmtDate(n.daily_date!) }} />
              ))}
            </div>

            {pinned.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 px-2 mb-1 flex items-center gap-1">
                  <Pin className="h-3 w-3" /> Pinned
                </div>
                {pinned.map(n => <Row key={n.id} n={n} />)}
              </div>
            )}

            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 px-2 mb-1 flex items-center gap-1">
                <FileText className="h-3 w-3" /> Pages
              </div>
              {pages.length === 0 ? (
                <div className="text-xs text-slate-400 px-2 py-2">No pages yet. Click + to create one.</div>
              ) : pages.map(n => <Row key={n.id} n={n} />)}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
