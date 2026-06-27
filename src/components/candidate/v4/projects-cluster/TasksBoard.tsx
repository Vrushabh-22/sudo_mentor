import { useEffect, useMemo, useState } from 'react';
import { Plus, Check, Trash2, Calendar, ListTodo, Columns3, X as XIcon } from 'lucide-react';
import { useCandidateTasks, CandidateTask } from './useCandidateTasks';
import { useMyProjects, MyProject } from './useMyProjects';
import { ProjectAccordionRow } from './ProjectAccordionRow';
import { colorForProject } from './projectPalette';

interface Props {
  candidateId: string;
  projectFilterId?: string | null;
  onClearFilter?: () => void;
}

const STATUS_LABEL: Record<CandidateTask['status'], string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};
const STATUS_TONE: Record<CandidateTask['status'], string> = {
  todo: 'border-slate-200',
  in_progress: 'border-violet-200',
  done: 'border-emerald-200',
};

export function TasksBoard({ candidateId, projectFilterId, onClearFilter }: Props) {
  const { tasks: allTasks, createTask, updateTask, deleteTask } = useCandidateTasks(candidateId);
  const { mine } = useMyProjects();

  const filterName = projectFilterId ? (mine.find(p => p.id === projectFilterId)?.title || 'Selected project') : null;

  if (!projectFilterId && mine.length > 1) {
    const today = new Date().toISOString().slice(0, 10);
    return (
      <div className="space-y-2.5">
        <div className="text-[11px] text-slate-500 px-0.5">
          You have {mine.length} active projects. Pick one to view & edit tasks.
        </div>
        {mine.map((p) => {
          const palette = colorForProject(p.id, mine)!;
          const projectTasks = allTasks.filter(t => t.project_id === p.id);
          const todayCount = projectTasks.filter(t => t.status !== 'done' && (!t.due_on || t.due_on <= today)).length;
          return (
            <ProjectAccordionRow
              key={p.id}
              title={p.title}
              meta={`${todayCount} for today · ${projectTasks.length} total`}
              palette={palette}
            >
              <TasksBoardInner
                project={p}
                allTasks={allTasks}
                mine={mine}
                createTask={createTask}
                updateTask={updateTask}
                deleteTask={deleteTask}
              />
            </ProjectAccordionRow>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filterName && (
        <div className="flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5">
          <div className="text-[11px] text-violet-800">
            Showing tasks for <span className="font-bold">{filterName}</span>
          </div>
          {onClearFilter && (
            <button onClick={onClearFilter} className="text-[11px] font-semibold text-violet-700 hover:text-violet-900 flex items-center gap-1">
              <XIcon className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}
      <TasksBoardInner
        forcedProjectId={projectFilterId || undefined}
        allTasks={allTasks}
        mine={mine}
        createTask={createTask}
        updateTask={updateTask}
        deleteTask={deleteTask}
      />
    </div>
  );
}

interface InnerProps {
  project?: MyProject;
  forcedProjectId?: string;
  allTasks: CandidateTask[];
  mine: MyProject[];
  createTask: (input: { title: string; project_id?: string | null; due_on?: string | null }) => Promise<void>;
  updateTask: (id: string, patch: Partial<CandidateTask>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

function TasksBoardInner({ project, forcedProjectId, allTasks, mine, createTask, updateTask, deleteTask }: InnerProps) {
  const scopedId = project?.id || forcedProjectId || null;
  const [view, setView] = useState<'today' | 'kanban'>('today');
  const [draft, setDraft] = useState('');
  const [draftProject, setDraftProject] = useState<string>(scopedId || '');
  const [draftDue, setDraftDue] = useState<string>('');

  useEffect(() => {
    if (scopedId) setDraftProject(scopedId);
  }, [scopedId]);

  const tasks = useMemo(
    () => (scopedId ? allTasks.filter(t => t.project_id === scopedId) : allTasks),
    [allTasks, scopedId],
  );

  const projectName = (id: string | null) => mine.find(p => p.id === id)?.title || 'General';

  const today = new Date().toISOString().slice(0, 10);
  const todayList = tasks.filter(t => t.status !== 'done' && (!t.due_on || t.due_on <= today));
  const byStatus = useMemo(() => ({
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    done: tasks.filter(t => t.status === 'done').slice(0, 30),
  }), [tasks]);

  const submit = async () => {
    if (!draft.trim()) return;
    await createTask({ title: draft, project_id: (scopedId || draftProject) || null, due_on: draftDue || null });
    setDraft(''); setDraftDue('');
  };

  const cycle = (t: CandidateTask) => {
    const next: CandidateTask['status'] =
      t.status === 'todo' ? 'in_progress' : t.status === 'in_progress' ? 'done' : 'todo';
    updateTask(t.id, { status: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setView('today')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${view === 'today' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600'}`}
          >
            <ListTodo className="h-3.5 w-3.5" /> Today
          </button>
          <button
            onClick={() => setView('kanban')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${view === 'kanban' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600'}`}
          >
            <Columns3 className="h-3.5 w-3.5" /> Kanban
          </button>
        </div>
        <div className="text-[11px] text-slate-500">{tasks.length} total</div>
      </div>

      <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="Add a task and press Enter…"
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-400"
          />
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="h-8 w-8 rounded-lg bg-violet-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={scopedId || draftProject}
            disabled={!!scopedId}
            onChange={e => setDraftProject(e.target.value)}
            className="text-[11px] bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 disabled:opacity-70"
          >
            <option value="">General</option>
            {mine.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Calendar className="h-3 w-3" />
            <input
              type="date"
              value={draftDue}
              onChange={e => setDraftDue(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-2 py-1"
            />
          </div>
        </div>
      </div>

      {view === 'today' ? (
        <div className="space-y-1.5">
          {todayList.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-8">No tasks for today. Add one above.</div>
          ) : todayList.map(t => (
            <TaskRow key={t.id} t={t} projectName={projectName(t.project_id)} onToggle={() => updateTask(t.id, { status: 'done' })} onDelete={() => deleteTask(t.id)} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {(['todo', 'in_progress', 'done'] as const).map(col => (
            <div key={col} className={`rounded-xl border ${STATUS_TONE[col]} bg-white p-2 flex flex-col gap-1.5 min-h-[200px]`}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 px-1 pb-1 flex items-center justify-between">
                <span>{STATUS_LABEL[col]}</span>
                <span className="text-slate-400">{byStatus[col].length}</span>
              </div>
              {byStatus[col].map(t => (
                <button
                  key={t.id}
                  onClick={() => cycle(t)}
                  className="text-left rounded-lg border border-slate-100 bg-white hover:border-violet-300 hover:shadow-sm transition p-2"
                >
                  <div className={`text-xs font-medium leading-snug ${col === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{t.title}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 truncate max-w-[8rem]">{projectName(t.project_id)}</span>
                    {t.due_on && <span>· {t.due_on.slice(5)}</span>}
                  </div>
                </button>
              ))}
              {byStatus[col].length === 0 && <div className="text-[11px] text-slate-300 px-1 py-2">Empty</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ t, projectName, onToggle, onDelete }: { t: CandidateTask; projectName: string; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 hover:border-violet-300 transition">
      <button onClick={onToggle} className="h-4 w-4 rounded border border-slate-300 hover:border-violet-500 flex items-center justify-center shrink-0">
        <Check className="h-3 w-3 text-transparent group-hover:text-violet-500" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-800 truncate">{t.title}</div>
        <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
          <span className="truncate">{projectName}</span>
          {t.due_on && <><span>·</span><span>{t.due_on.slice(5)}</span></>}
        </div>
      </div>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
