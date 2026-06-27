import { useEffect, useState } from 'react';
import { useNotes } from './useNotes';
import { NotesSidebar } from './NotesSidebar';
import { NoteEditor } from './NoteEditor';
import { Loader2 } from 'lucide-react';

interface Props {
  candidateId: string;
  tenantId?: string | null;
}

export function NotesWorkspace({ candidateId, tenantId }: Props) {
  const { pinned, pages, dailies, notes, loading, createPage, getOrCreateDaily, updateNote, archiveNote, togglePin } = useNotes(candidateId, tenantId);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (activeId && notes.some(n => n.id === activeId)) return;
    const first = pinned[0] || pages[0] || dailies[0];
    if (first) setActiveId(first.id);
  }, [activeId, notes, pinned, pages, dailies]);

  const active = notes.find(n => n.id === activeId) || null;

  const handleCreate = async () => {
    const n = await createPage();
    setActiveId(n.id);
  };

  const handleOpenDaily = async (dateISO: string) => {
    const n = await getOrCreateDaily(dateISO);
    setActiveId(n.id);
  };

  return (
    <div className="flex h-full w-full bg-white overflow-hidden">
      <NotesSidebar
        pinned={pinned}
        pages={pages}
        dailies={dailies}
        activeId={activeId}
        onSelect={setActiveId}
        onCreatePage={handleCreate}
        onOpenDaily={handleOpenDaily}
      />
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading notes…
          </div>
        ) : !active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="text-5xl mb-3">📝</div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Start your first note</h3>
            <p className="text-sm text-slate-500 mb-4 max-w-sm">Capture ideas, plan your day, or keep a journal. Everything saves automatically.</p>
            <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700">
              New page
            </button>
          </div>
        ) : (
          <NoteEditor
            note={active}
            onChange={(patch) => updateNote(active.id, patch)}
            onArchive={() => { archiveNote(active.id); setActiveId(null); }}
            onTogglePin={(v) => togglePin(active.id, v)}
          />
        )}
      </div>
    </div>
  );
}
