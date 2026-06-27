import { useEffect, useState } from 'react';
import { Github, ExternalLink, Sparkles, Loader2, FileCode2, CheckCircle2, Trophy, AlertTriangle, Rocket, X as XIcon } from 'lucide-react';
import { invokeV4 } from '@/lib/candidatePortalV4Client';
import { supabase } from '@/integrations/supabase/client';
import { useMyProjects } from './useMyProjects';
import { useToast } from '@/hooks/use-toast';
import { ProjectAccordionRow } from './ProjectAccordionRow';
import { colorForProject } from './projectPalette';

interface Props {
  candidateId: string;
  projectIdOverride?: string | null;
  onClearOverride?: () => void;
}

interface Detail {
  project: any;
  submission: any | null;
  mentor: any | null;
}

export function CodeInsightsBoard({ candidateId: _candidateId, projectIdOverride, onClearOverride }: Props) {
  const { mine, loading } = useMyProjects();

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></div>;
  if (mine.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/30 p-8 text-center">
        <Rocket className="h-7 w-7 text-violet-500 mx-auto mb-2" />
        <div className="text-sm font-semibold text-slate-800">No active projects yet</div>
        <div className="text-xs text-slate-500 mt-1">Subscribe to a project from the Hub to see your code & AI insights here.</div>
      </div>
    );
  }

  if (!projectIdOverride && mine.length > 1) {
    return (
      <div className="space-y-2.5">
        <div className="text-[11px] text-slate-500 px-0.5">
          {mine.length} active projects. Expand one to see repo & AI review.
        </div>
        {mine.map(p => {
          const palette = colorForProject(p.id, mine)!;
          const sub = p.my_submission;
          const score = sub?.candidate_project_evaluations?.[0]?.overall_score;
          const meta = sub
            ? sub.status === 'evaluated'
              ? `Evaluated · ${Math.round(score || 0)} / 100`
              : sub.status === 'submitted' ? 'Under review'
              : 'In progress'
            : 'Not started';
          return (
            <ProjectAccordionRow key={p.id} title={p.title} meta={meta} palette={palette}>
              <CodeInsightsInner projectId={p.id} />
            </ProjectAccordionRow>
          );
        })}
      </div>
    );
  }

  const effectiveId = projectIdOverride || mine[0].id;
  const lockedName = projectIdOverride ? (mine.find(p => p.id === projectIdOverride)?.title || 'Selected project') : null;

  return (
    <div className="space-y-3">
      {lockedName && (
        <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 w-fit">
          <span className="text-[11px] text-violet-800">Showing <span className="font-bold">{lockedName}</span></span>
          {onClearOverride && (
            <button onClick={onClearOverride} className="text-[11px] font-semibold text-violet-700 hover:text-violet-900 flex items-center gap-0.5">
              <XIcon className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}
      <CodeInsightsInner projectId={effectiveId} />
    </div>
  );
}

function CodeInsightsInner({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const loadDetail = () => {
    setBusy(true);
    return invokeV4({ action: 'get_project', project_id: projectId }).then(({ data }) => {
      setDetail(data as Detail);
      setBusy(false);
    });
  };

  useEffect(() => { loadDetail(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  const submission = detail?.submission;
  const evalRow = submission?.candidate_project_evaluations?.[0];
  const githubUrl = submission?.github_url as string | undefined;

  const reEvaluate = async () => {
    if (!submission?.id) return;
    setReviewing(true);
    try {
      const { error } = await supabase.functions.invoke('evaluate-micro-project', { body: { submission_id: submission.id } });
      if (error) throw error;
      toast({ title: 'AI review started', description: 'Refresh in a moment to see results.' });
      setTimeout(() => { loadDetail(); }, 2000);
    } catch (e: any) {
      toast({ title: 'Could not start review', description: e.message, variant: 'destructive' });
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-full">
      <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Github className="h-4 w-4" /> Repository
        </div>
        {busy ? (
          <div className="text-xs text-slate-400">Loading…</div>
        ) : !githubUrl ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
            <FileCode2 className="h-5 w-5 text-slate-400 mx-auto mb-1.5" />
            <div className="text-xs text-slate-600">No GitHub link yet. Open the project from the Hub to submit your repo URL.</div>
          </div>
        ) : (
          <div className="space-y-2">
            <a href={githubUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:border-violet-300 hover:bg-violet-50/40 transition">
              <div className="flex items-center gap-2 min-w-0">
                <Github className="h-4 w-4 text-slate-700 shrink-0" />
                <span className="text-xs font-mono text-slate-700 truncate">{githubUrl.replace(/^https?:\/\//, '')}</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </a>
            <div className="flex items-center gap-2 text-[11px]">
              <span className={`px-2 py-0.5 rounded-full font-semibold ${
                submission?.status === 'evaluated' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                submission?.status === 'submitted' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-slate-50 text-slate-700 border border-slate-200'
              }`}>{submission?.status || 'in progress'}</span>
              {submission?.submitted_at && <span className="text-slate-500">Submitted {new Date(submission.submitted_at).toLocaleDateString()}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-2 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/40 to-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-violet-600" /> AI Review
          </div>
          {submission?.id && (
            <button onClick={reEvaluate} disabled={reviewing || !githubUrl} className="text-[11px] font-semibold text-violet-700 hover:underline disabled:opacity-40 flex items-center gap-1">
              {reviewing && <Loader2 className="h-3 w-3 animate-spin" />}
              Re-analyze
            </button>
          )}
        </div>

        {!evalRow ? (
          <div className="text-xs text-slate-500">
            {submission?.status === 'submitted' ? 'Evaluation in progress…' : 'Submit your repo to receive an AI review with strengths, gaps and an overall score.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-600" />
              <span className="text-2xl font-extrabold text-slate-900">{Math.round(evalRow.overall_score || 0)}</span>
              <span className="text-xs text-slate-500">/ 100</span>
            </div>
            {Array.isArray(evalRow.strengths) && evalRow.strengths.length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase text-emerald-700 mb-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Strengths</div>
                <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                  {evalRow.strengths.slice(0, 3).map((s: string, i: number) => <li key={i} className="leading-snug">{s}</li>)}
                </ul>
              </div>
            )}
            {Array.isArray(evalRow.gaps) && evalRow.gaps.length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase text-rose-700 mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Gaps</div>
                <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                  {evalRow.gaps.slice(0, 3).map((s: string, i: number) => <li key={i} className="leading-snug">{s}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
