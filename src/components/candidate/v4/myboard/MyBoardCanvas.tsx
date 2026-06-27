import { useEffect, useMemo, useRef, useState } from 'react';
import { V4Bootstrap } from '@/pages/CandidatePortalV4';
import { useCanvasViewport } from './useCanvasViewport';
import { BoardFrame } from './BoardFrame';
import { ClusterConnectors } from './ClusterConnectors';
import { V4Home } from '../V4Home';
import { MentorCopilot } from '../MentorCopilot';
import { PracticeHub } from '../PracticeHub';
import { LeaderboardView } from '../LeaderboardView';
import { V4Projects } from '../V4Projects';
import { V4JobsTab } from '../V4JobsTab';
import { CandidateProfileV4 } from '../CandidateProfileV4';
import { NotesWorkspace } from '../notes/NotesWorkspace';
import { TasksBoard } from '../projects-cluster/TasksBoard';
import { CodeInsightsBoard } from '../projects-cluster/CodeInsightsBoard';
import { useMyProjects } from '../projects-cluster/useMyProjects';
import { colorForProject } from '../projects-cluster/projectPalette';
import { Plus, Minus, Maximize, RotateCcw, ExternalLink, Target } from 'lucide-react';

const W = 820;
const H = 640;
const GAP = 80;
const PAD = 400;

type BoardId =
  | 'home' | 'mentor' | 'practice' | 'rank'
  | 'jobs' | 'profile' | 'notes'
  | 'proj_catalog' | 'proj_tasks' | 'proj_code';

interface BoardDef {
  id: BoardId;
  emoji: string;
  label: string;
  subtitle: string;
  color: string;
  col: number;
  row: number;
  wMul?: number;
}

const TOP_BOARDS: BoardDef[] = [
  { id: 'home',     emoji: '🏠', label: 'Home',     subtitle: 'Dashboard & daily mission', color: '#7C3AED', col: 0, row: 0 },
  { id: 'mentor',   emoji: '🤖', label: 'Mentor',   subtitle: 'AI placement copilot',      color: '#0891B2', col: 1, row: 0 },
  { id: 'practice', emoji: '📚', label: 'Practice', subtitle: '2 attempts a day',          color: '#059669', col: 0, row: 1 },
  { id: 'rank',     emoji: '🏆', label: 'Rank',     subtitle: 'Campus leaderboard',        color: '#D97706', col: 1, row: 1 },
  { id: 'jobs',     emoji: '💼', label: 'Jobs',     subtitle: 'Track applications',        color: '#0D9488', col: 0, row: 2 },
  { id: 'profile',  emoji: '👤', label: 'Profile',  subtitle: 'Your verified identity',    color: '#EC4899', col: 1, row: 2 },
  { id: 'notes',    emoji: '📝', label: 'Notes',    subtitle: 'Daily journal & ideas',     color: '#4F46E5', col: 0, row: 3 },
];

const CLUSTER_GAP_ROWS = 1.4;
const CLUSTER_ROW_START = 4;

const PROJECT_BOARDS: BoardDef[] = [
  { id: 'proj_catalog', emoji: '🚀', label: 'Project Catalog',  subtitle: 'Browse & subscribe',  color: '#9333EA', col: 0, row: 0 },
  { id: 'proj_tasks',   emoji: '✅', label: 'Daily Tasks',      subtitle: 'Today & Kanban',      color: '#0891B2', col: 1, row: 0 },
  { id: 'proj_code',    emoji: '💻', label: 'Code & Insights',  subtitle: 'GitHub + AI review',  color: '#7C3AED', col: 2, row: 0 },
];

const ALL_BOARDS: BoardDef[] = [
  ...TOP_BOARDS,
  ...PROJECT_BOARDS.map(b => ({ ...b, row: b.row + CLUSTER_ROW_START })),
];

function tileXY(b: BoardDef) {
  const beforeCluster = b.row >= CLUSTER_ROW_START ? (H + GAP) * CLUSTER_GAP_ROWS - (H + GAP) : 0;
  const x = PAD + b.col * (W + GAP);
  const y = PAD + b.row * (H + GAP) + beforeCluster;
  const w = (b.wMul || 1) * W + ((b.wMul || 1) - 1) * GAP;
  return { x, y, w, h: H };
}

interface Props {
  bootstrap: V4Bootstrap;
  onRefresh: () => void;
  candidateId: string;
  candidateEmail: string;
  fullscreen?: boolean;
}

export function MyBoardCanvas({ bootstrap, onRefresh, candidateId, candidateEmail, fullscreen }: Props) {
  const c = bootstrap.candidate;
  const vp = useCanvasViewport({ minScale: 0.12, maxScale: 1.6 });
  const inited = useRef(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeLink, setActiveLink] = useState<'tasks' | 'code' | null>(null);
  const { mine } = useMyProjects();
  const selectedPalette = colorForProject(selectedProjectId, mine);

  const totalRect = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ALL_BOARDS.forEach(b => {
      const { x, y, w, h } = tileXY(b);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, []);

  const clusterRect = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    PROJECT_BOARDS.forEach(b => {
      const def = { ...b, row: b.row + CLUSTER_ROW_START };
      const { x, y, w, h } = tileXY(def);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, []);

  const tileFor = (id: BoardId) => {
    const b = ALL_BOARDS.find(x => x.id === id)!;
    return tileXY(b);
  };

  const focusBoard = (id: BoardId) => {
    const { x, y, w, h } = tileFor(id);
    vp.fitRect({ x: x - 40, y: y - 40, w: w + 80, h: h + 80 }, 60);
  };

  const focusCluster = () => vp.fitRect({ x: clusterRect.x - 60, y: clusterRect.y - 120, w: clusterRect.w + 120, h: clusterRect.h + 160 }, 60);
  const fitAll = () => vp.fitRect(totalRect, 60);

  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    const t1 = setTimeout(() => fitAll(), 30);
    const t2 = setTimeout(() => focusBoard('home'), 650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResize = () => fitAll();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveLink('tasks');
    setTimeout(() => focusCluster(), 50);
    setTimeout(() => setActiveLink(null), 2200);
  };

  const renderBody = (id: BoardId) => {
    switch (id) {
      case 'home':
        return <V4Home bootstrap={bootstrap} onNavigate={(t: string) => {
          const map: Record<string, BoardId> = {
            mentor: 'mentor', practice: 'practice', leaderboard: 'rank',
            jobs: 'jobs', profile: 'profile', projects: 'proj_catalog', home: 'home',
          };
          const target = map[t];
          if (target) focusBoard(target);
        }} />;
      case 'mentor':   return <MentorCopilot candidate={c} onProfileChanged={onRefresh} />;
      case 'practice': return <PracticeHub bootstrap={bootstrap} onDone={onRefresh} />;
      case 'rank':     return <LeaderboardView candidate={c} />;
      case 'proj_catalog':
        return <V4Projects
          onSelectProject={handleSelectProject}
          selectedProjectId={selectedProjectId}
        />;
      case 'jobs':     return <V4JobsTab candidateId={candidateId} candidateEmail={candidateEmail} />;
      case 'profile':  return <CandidateProfileV4 candidate={c} onSaved={onRefresh} />;
      case 'notes':    return <NotesWorkspace candidateId={candidateId} tenantId={(c as any)?.tenant_id || null} />;
      case 'proj_tasks':
        return <TasksBoard
          candidateId={candidateId}
          projectFilterId={selectedProjectId}
          onClearFilter={() => setSelectedProjectId(null)}
        />;
      case 'proj_code':
        return <CodeInsightsBoard
          candidateId={candidateId}
          projectIdOverride={selectedProjectId}
          onClearOverride={() => setSelectedProjectId(null)}
        />;
    }
  };

  const railEntries: Array<{ id: BoardId | 'cluster'; emoji: string; label: string; onClick: () => void }> = [
    ...TOP_BOARDS.map(b => ({ id: b.id, emoji: b.emoji, label: b.label, onClick: () => focusBoard(b.id) })),
    { id: 'cluster' as const, emoji: '🎯', label: 'My Projects', onClick: focusCluster },
  ];

  return (
    <div className={fullscreen ? 'relative w-full h-screen overflow-hidden' : 'relative w-full h-[calc(100vh-9rem)] lg:h-[calc(100vh-6rem)] -mx-3 sm:-mx-4 lg:-mx-6 rounded-xl overflow-hidden border border-violet-100 bg-white'}>
      <div
        ref={vp.outerRef}
        className="absolute inset-0 overflow-hidden touch-none select-none"
        style={{
          cursor: 'grab',
          background: '#F4F1FB',
          backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.16) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
        onPointerDown={vp.onPointerDown}
        onPointerMove={vp.onPointerMove}
        onPointerUp={vp.onPointerUp}
        onPointerCancel={vp.onPointerUp}
      >
        <div
          style={{
            position: 'absolute', top: 0, left: 0, transformOrigin: '0 0',
            transform: `translate(${vp.offset.x}px, ${vp.offset.y}px) scale(${vp.scale})`,
            transition: vp.anim ? 'transform 0.45s cubic-bezier(0.33,1,0.68,1)' : 'none',
            willChange: 'transform',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: clusterRect.x,
              top: clusterRect.y - 130,
              width: clusterRect.w,
              pointerEvents: 'none',
            }}
          >
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg">
                <Target className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="text-4xl font-extrabold text-slate-900 tracking-tight">My Projects</div>
                <div className="text-sm text-slate-500 mt-0.5">Browse a project · its tasks &amp; code light up beside it</div>
              </div>
            </div>
            <div className="mt-4 h-px bg-gradient-to-r from-violet-300 via-violet-200 to-transparent" />
          </div>

          <ClusterConnectors
            rect={clusterRect}
            catalog={tileFor('proj_catalog')}
            tasks={tileFor('proj_tasks')}
            code={tileFor('proj_code')}
            active={activeLink}
          />

          {ALL_BOARDS.map(b => {
            const { x, y, w, h } = tileXY(b);
            const color =
              selectedPalette && (b.id === 'proj_tasks' || b.id === 'proj_code')
                ? selectedPalette.bar
                : b.color;
            return (
              <BoardFrame
                key={b.id}
                emoji={b.emoji}
                title={b.label}
                subtitle={b.subtitle}
                color={color}
                x={x} y={y} w={w} h={h}
                onFocus={() => focusBoard(b.id)}
              >
                {renderBody(b.id)}
              </BoardFrame>
            );
          })}
        </div>

        <div
          data-canvas-toolbar="true"
          className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 backdrop-blur rounded-xl border border-violet-100 shadow-md p-1"
        >
          <button onClick={() => vp.zoomBy(0.85)} className="p-2 rounded-lg hover:bg-violet-50 text-slate-600" title="Zoom out">
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold text-slate-600 min-w-[3rem] text-center">{Math.round(vp.scale * 100)}%</span>
          <button onClick={() => vp.zoomBy(1.18)} className="p-2 rounded-lg hover:bg-violet-50 text-slate-600" title="Zoom in">
            <Plus className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button onClick={fitAll} className="p-2 rounded-lg hover:bg-violet-50 text-slate-600" title="Fit all">
            <Maximize className="h-4 w-4" />
          </button>
          <button onClick={() => focusBoard('home')} className="p-2 rounded-lg hover:bg-violet-50 text-slate-600" title="Reset to Home">
            <RotateCcw className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button
            onClick={() => window.open('/?fullscreenBoard=1', '_blank')}
            className="p-2 rounded-lg hover:bg-violet-50 text-slate-600"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>

        <div
          data-canvas-toolbar="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-white/95 backdrop-blur rounded-2xl border border-violet-100 shadow-md p-1.5"
        >
          {railEntries.map(r => (
            <button
              key={r.id}
              onClick={r.onClick}
              title={r.label}
              aria-label={r.label}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg hover:bg-violet-50 transition-colors"
            >
              <span>{r.emoji}</span>
            </button>
          ))}
        </div>

        <div className="absolute top-3 left-3 text-[11px] font-medium text-slate-500 bg-white/85 backdrop-blur px-3 py-1.5 rounded-full border border-violet-100 shadow-sm pointer-events-none">
          Drag to pan · Ctrl/⌘ + scroll to zoom
        </div>
      </div>
    </div>
  );
}
