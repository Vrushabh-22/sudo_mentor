import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeV4 } from '@/lib/candidatePortalV4Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, Clock, Hammer, Github, Upload, X, Sparkles, CheckCircle2,
  FileText, Building2, ExternalLink, Lock, Rocket, ArrowRight, Trophy, Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useCandidateAuth } from '@/hooks/useCandidateAuth';
import { V4ProjectMentorChat } from './V4ProjectMentorChat';
import { PROJECT_CAP, colorForProject, ProjectPaletteEntry } from './projects-cluster/projectPalette';

function ReactMarkdown({ children }: { children: string }) {
  return <div className="whitespace-pre-wrap text-sm leading-relaxed">{children}</div>;
}

interface ProjectListItem {
  id: string;
  company_name: string;
  company_logo_url?: string;
  title: string;
  duration_hours: number;
  difficulty: string;
  tech_stack: string[];
  tags: string[];
  problem_statement?: string;
  my_submission?: { id: string; status: string; candidate_project_evaluations?: { overall_score: number }[] } | null;
}

interface ProjectFull extends ProjectListItem {
  problem_statement: string;
  outcome_required: string;
  resources: any[];
  evaluation_rubric: any[];
  mentor_user_id?: string;
}

const difficultyDot: Record<string, string> = {
  beginner: 'bg-emerald-500',
  intermediate: 'bg-amber-500',
  advanced: 'bg-rose-500',
};

const HERO_LIGHT = 'from-violet-100 via-white to-fuchsia-50';

function getStatus(p: ProjectListItem): 'available' | 'in_progress' | 'submitted' | 'evaluated' {
  const s = p.my_submission?.status;
  if (s === 'evaluated') return 'evaluated';
  if (s === 'submitted') return 'submitted';
  if (s === 'in_progress') return 'in_progress';
  return 'available';
}

interface V4ProjectsProps {
  onSelectProject?: (projectId: string) => void;
  selectedProjectId?: string | null;
}

export function V4Projects({ onSelectProject, selectedProjectId: _selectedProjectId }: V4ProjectsProps = {}) {
  const { toast } = useToast();
  const { user } = useCandidateAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ project: ProjectFull; submission: any; mentor: any } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [tab, setTab] = useState<'available' | 'mine'>('available');

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await invokeV4({ action: 'list_projects' });
    if (error) toast({ title: 'Failed to load projects', variant: 'destructive' });
    else setProjects((data as any)?.projects || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const { available, mine } = useMemo(() => {
    const a: ProjectListItem[] = []; const m: ProjectListItem[] = [];
    for (const p of projects) (p.my_submission ? m : a).push(p);
    return { available: a, mine: m };
  }, [projects]);

  const capReached = mine.length >= PROJECT_CAP;

  const openProject = async (id: string, status?: string) => {
    if (status === 'available' && capReached) {
      toast({
        title: `Limit reached (${PROJECT_CAP}/${PROJECT_CAP})`,
        description: 'Finish or drop one to add another.',
        variant: 'destructive',
      });
      return;
    }
    onSelectProject?.(id);
    setOpenId(id);
    setLoadingDetail(true);
    setDetail(null);
    const { data } = await invokeV4({ action: 'get_project', project_id: id });
    setDetail(data as any);
    setLoadingDetail(false);
  };

  const list = tab === 'available' ? available : mine;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 ring-1 ring-violet-500/20 shadow-lg shadow-violet-900/20 p-5 sm:p-6">
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative">
          <h2 className="text-2xl font-extrabold flex items-center gap-2 tracking-tight text-white">
            <Hammer className="h-6 w-6 text-violet-300" /> Build real things
          </h2>
          <p className="text-sm text-violet-200/80 mt-1">Pick a project from a real company. Subscribe, build, ship — get scored by AI. <span className="text-violet-300">Up to {PROJECT_CAP} active at a time.</span></p>

          <div className="mt-4 inline-flex bg-white/5 border border-white/10 rounded-xl p-1 backdrop-blur-sm">
            <TabBtn active={tab === 'available'} onClick={() => setTab('available')} label="Available" count={available.length} />
            <TabBtn active={tab === 'mine'} onClick={() => setTab('mine')} label="My Projects" count={mine.length} suffix={` / ${PROJECT_CAP}`} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>
      ) : list.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            {tab === 'available' ? <Rocket className="h-7 w-7 text-slate-700" /> : <Hammer className="h-7 w-7 text-slate-700" />}
          </div>
          <div className="font-semibold">{tab === 'available' ? 'No projects right now' : "You haven't subscribed to any project yet"}</div>
          <p className="text-xs text-muted-foreground mt-1">{tab === 'available' ? 'Check back soon — new projects drop weekly.' : 'Browse Available and subscribe to one to start building.'}</p>
          {tab === 'mine' && available.length > 0 && (
            <Button onClick={() => setTab('available')} className="mt-4 bg-violet-600 hover:bg-violet-700 text-white">Browse Available</Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((p) => {
            const palette = p.my_submission ? colorForProject(p.id, mine) : null;
            const disabled = !p.my_submission && capReached;
            return (
              <ProjectCard
                key={p.id}
                p={p}
                palette={palette}
                disabled={disabled}
                onOpen={() => openProject(p.id, getStatus(p))}
              />
            );
          })}
        </div>
      )}

      <Sheet open={!!openId} onOpenChange={(o) => { if (!o) { setOpenId(null); setDetail(null); } }}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 overflow-hidden">
          {loadingDetail || !detail ? (
            <div className="flex items-center justify-center h-screen"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>
          ) : (
            <ProjectDetail
              data={detail}
              onChanged={() => { refresh(); openProject(detail.project.id); }}
              candidateUserId={user?.id || ''}
              canSubscribe={!capReached}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TabBtn({ active, onClick, label, count, suffix }: { active: boolean; onClick: () => void; label: string; count: number; suffix?: string }) {
  return (
    <button onClick={onClick} className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
      active ? 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md shadow-violet-900/30' : 'text-violet-100/70 hover:text-white'
    }`}>
      {label}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-white/10 text-violet-100'}`}>{count}{suffix || ''}</span>
    </button>
  );
}

function ProjectCard({ p, palette, disabled, onOpen }: { p: ProjectListItem; palette: ProjectPaletteEntry | null; disabled?: boolean; onOpen: () => void }) {
  const status = getStatus(p);
  const score = p.my_submission?.candidate_project_evaluations?.[0]?.overall_score;
  const hook = (p.problem_statement || '').replace(/[#*`]/g, '').slice(0, 130).trim();

  const cta = status === 'available' ? { label: 'Subscribe & Start', icon: Rocket }
    : status === 'in_progress' ? { label: 'Continue Building', icon: ArrowRight }
    : status === 'submitted' ? { label: 'View Submission', icon: ArrowRight }
    : { label: `View Report · ${Math.round(score || 0)}`, icon: Trophy };

  const Icon = cta.icon;

  const heroStyle = palette
    ? { background: palette.bg, borderTop: `4px solid ${palette.bar}` }
    : undefined;
  const heroClass = palette
    ? 'relative h-24 p-3 flex items-end overflow-hidden border-b'
    : `relative h-24 bg-gradient-to-br ${HERO_LIGHT} p-3 flex items-end overflow-hidden border-b border-violet-100/70`;

  return (
    <button
      onClick={onOpen}
      className={`text-left group bg-white rounded-2xl border border-slate-200 hover:border-violet-200 hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <div className={heroClass} style={heroStyle}>
        {!palette && <>
          <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-violet-500/15 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-fuchsia-400/15 blur-2xl" />
        </>}
        <div className="relative flex items-end gap-2.5 w-full">
          <div className="h-12 w-12 rounded-xl bg-white ring-1 ring-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
            {p.company_logo_url ? <img src={p.company_logo_url} alt="" className="h-full w-full object-contain p-0.5" /> : <Building2 className="h-5 w-5 text-slate-400" />}
          </div>
          <div className="min-w-0 flex-1 pb-0.5">
            <div
              className="text-[10px] font-semibold uppercase tracking-wider truncate"
              style={palette ? { color: palette.text } : undefined}
            >{p.company_name}</div>
            <div className="font-semibold text-slate-900 text-sm leading-tight line-clamp-2">{p.title}</div>
          </div>
          <StatusPill status={status} score={score} />
        </div>
      </div>

      <div className="p-3.5 flex-1 flex flex-col gap-3">
        {hook && <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{hook}…</p>}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-[10px] capitalize bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
            <span className={`h-1.5 w-1.5 rounded-full ${difficultyDot[p.difficulty] || 'bg-slate-400'}`} />
            {p.difficulty}
          </span>
          <Badge variant="outline" className="text-[10px] gap-1 border-slate-200 text-slate-700"><Clock className="h-2.5 w-2.5" /> {p.duration_hours}h</Badge>
          {(p.tech_stack || []).slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-100">{t}</Badge>
          ))}
          {(p.tech_stack || []).length > 3 && (
            <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-700">+{p.tech_stack.length - 3}</Badge>
          )}
        </div>

        <div className="mt-auto pt-2 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Zap className="h-3 w-3 text-violet-500" /> AI evaluated
          </div>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
            disabled
              ? 'bg-slate-200 text-slate-500'
              : status === 'available'
              ? 'bg-violet-600 text-white group-hover:bg-violet-700'
              : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
          }`}>
            <Icon className="h-3 w-3" /> {disabled ? `Limit ${PROJECT_CAP}/${PROJECT_CAP}` : cta.label}
          </span>
        </div>
      </div>
    </button>
  );
}

function StatusPill({ status, score }: { status: string; score?: number }) {
  const cfg = status === 'evaluated' ? { label: `★ ${Math.round(score || 0)}`, cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' }
    : status === 'submitted' ? { label: 'Under Review', cls: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200' }
    : status === 'in_progress' ? { label: 'In Progress', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' }
    : { label: 'New', cls: 'bg-white text-slate-700 ring-1 ring-slate-200' };
  return <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${cfg.cls}`}>{cfg.label}</span>;
}

function ProjectDetail({ data, onChanged, candidateUserId, canSubscribe = true }: { data: any; onChanged: () => void; candidateUserId: string; canSubscribe?: boolean }) {
  const { project, submission, mentor } = data;
  const subscribed = !!submission;
  const evaluation = submission?.candidate_project_evaluations?.[0];
  const showReport = submission?.status === 'evaluated' && evaluation;

  return (
    <div className="h-full flex flex-col">
      <div className={`relative bg-gradient-to-br ${HERO_LIGHT} text-slate-900 p-5 pt-6 shrink-0 border-b border-violet-100`}>
        <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-violet-500/15 blur-2xl" />
        <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-fuchsia-400/15 blur-2xl" />
        <SheetHeader>
          <div className="flex items-center gap-3 relative">
            <div className="h-14 w-14 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center overflow-hidden shrink-0">
              {project.company_logo_url ? <img src={project.company_logo_url} alt="" className="h-full w-full object-contain p-1" /> : <Building2 className="h-6 w-6 text-slate-400" />}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-violet-700/80 font-semibold">{project.company_name}</div>
              <SheetTitle className="text-left text-xl text-slate-900 leading-tight">{project.title}</SheetTitle>
            </div>
          </div>
        </SheetHeader>
        <div className="flex flex-wrap gap-1.5 mt-3 relative">
          <Badge className="bg-white text-slate-700 ring-1 ring-slate-200 border-0 capitalize hover:bg-white">{project.difficulty}</Badge>
          <Badge className="bg-white text-slate-700 ring-1 ring-slate-200 border-0 gap-1 hover:bg-white"><Clock className="h-3 w-3" /> {project.duration_hours} hrs</Badge>
          {(project.tech_stack || []).slice(0, 5).map((t: string) => <Badge key={t} className="bg-white text-slate-700 ring-1 ring-slate-200 border-0 hover:bg-white">{t}</Badge>)}
        </div>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_360px] min-h-0">
        <div className="overflow-y-auto p-5 space-y-5 min-w-0">
          <Section title="Problem statement"><Markdown content={project.problem_statement} /></Section>
          <Section title="Expected outcome"><Markdown content={project.outcome_required} /></Section>

          {(project.resources || []).length > 0 && (
            <Section title="Resources">
              <ul className="space-y-1">
                {project.resources.map((r: any, i: number) => (
                  <li key={i}>
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-sm text-violet-600 hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> {r.label || r.url}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {(project.evaluation_rubric || []).length > 0 && (
            <Section title="How you'll be evaluated">
              <div className="space-y-1.5">
                {project.evaluation_rubric.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
                    <Badge variant="outline" className="shrink-0">{r.weight}%</Badge>
                    <div className="min-w-0">
                      <div className="font-semibold">{r.name}</div>
                      {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {mentor && (
            <Card className="p-3 flex items-center gap-3 bg-slate-50 border-slate-200">
              <Avatar className="h-9 w-9"><AvatarImage src={mentor.avatar_url} /><AvatarFallback className="bg-slate-200 text-slate-700 text-xs">{(mentor.first_name?.[0] || 'M').toUpperCase()}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">Project owner</div>
                <div className="text-sm font-semibold truncate">{[mentor.first_name, mentor.last_name].filter(Boolean).join(' ') || mentor.email}</div>
              </div>
            </Card>
          )}

          {showReport && <EvaluationReport evaluation={evaluation} />}
        </div>

        <div className="border-t md:border-t-0 md:border-l border-slate-200 bg-slate-50/40 overflow-y-auto p-4 space-y-4">
          {!subscribed ? (
            <SubscribeCard projectId={project.id} onSubscribed={onChanged} canSubscribe={canSubscribe} />
          ) : (
            <>
              <V4ProjectMentorChat projectId={project.id} projectTitle={project.title} />
              <SubmitPanel projectId={project.id} existing={submission} onSubmitted={onChanged} candidateUserId={candidateUserId} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SubscribeCard({ projectId, onSubscribed, canSubscribe = true }: { projectId: string; onSubscribed: () => void; canSubscribe?: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const subscribe = async () => {
    if (!canSubscribe) return;
    setLoading(true);
    const { error } = await invokeV4({ action: 'subscribe_project', project_id: projectId });
    setLoading(false);
    if (error) { toast({ title: 'Could not subscribe', description: error.message, variant: 'destructive' }); return; }
    toast({ title: "You're in! Project added to My Projects." });
    onSubscribed();
  };
  return (
    <Card className="p-5 bg-white border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-9 w-9 rounded-xl bg-violet-600 flex items-center justify-center"><Rocket className="h-4 w-4 text-white" /></div>
        <div>
          <h3 className="font-bold text-sm">Subscribe to start</h3>
          <p className="text-[11px] text-muted-foreground">Free · Adds to My Projects</p>
        </div>
      </div>
      <ul className="text-xs text-slate-700 space-y-1.5 my-3">
        <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" /> Unlocks your personal Project Mentor (AI)</li>
        <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" /> Submit GitHub URL or upload files</li>
        <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" /> Get an instant AI evaluation report</li>
        <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" /> Earn XP and climb the leaderboard</li>
      </ul>
      {!canSubscribe && (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          You can build up to {PROJECT_CAP} projects at a time. Finish or drop one to add another.
        </div>
      )}
      <Button onClick={subscribe} disabled={loading || !canSubscribe} className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold disabled:opacity-60">
        {!canSubscribe
          ? <><Lock className="h-4 w-4 mr-2" /> Limit reached ({PROJECT_CAP} / {PROJECT_CAP})</>
          : loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Subscribing…</> : <><Rocket className="h-4 w-4 mr-2 text-indigo-300" /> Subscribe & Start Building</>}
      </Button>
      <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-2">
        <Lock className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-slate-500">Submission and Mentor chat unlock after you subscribe.</p>
      </div>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{title}</h3>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function Markdown({ content }: { content: string }) {
  return <div className="prose prose-sm max-w-none"><ReactMarkdown>{content || ''}</ReactMarkdown></div>;
}

function SubmitPanel({ projectId, existing, onSubmitted, candidateUserId }: { projectId: string; existing: any; onSubmitted: () => void; candidateUserId: string }) {
  const { toast } = useToast();
  const [github, setGithub] = useState(existing?.github_url || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [files, setFiles] = useState<{ path: string; name: string }[]>(existing?.submission_files || []);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isGitValid = !github || /^https?:\/\/(www\.)?github\.com\/[^\/\s]+\/[^\/\s]+/i.test(github);

  const handleUpload = async (fileList: FileList) => {
    if (!candidateUserId) { toast({ title: 'Please log in again', variant: 'destructive' }); return; }
    setUploading(true);
    const next = [...files];
    for (const f of Array.from(fileList)) {
      if (f.size > 5 * 1024 * 1024) { toast({ title: `${f.name} is too large (max 5MB)`, variant: 'destructive' }); continue; }
      const path = `${candidateUserId}/${projectId}/${Date.now()}-${f.name}`;
      const { error } = await supabase.storage.from('project-submissions').upload(path, f, { upsert: true });
      if (error) { toast({ title: `Upload failed: ${f.name}`, description: error.message, variant: 'destructive' }); continue; }
      next.push({ path, name: f.name });
    }
    setFiles(next);
    setUploading(false);
  };

  const removeFile = async (idx: number) => {
    const f = files[idx];
    try { await supabase.storage.from('project-submissions').remove([f.path]); } catch {}
    setFiles(files.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!github && files.length === 0) { toast({ title: 'Add a GitHub URL or upload files first', variant: 'destructive' }); return; }
    if (!isGitValid) { toast({ title: 'GitHub URL looks invalid', variant: 'destructive' }); return; }
    setSubmitting(true);
    const { error } = await invokeV4({ action: 'submit_project', project_id: projectId, github_url: github || null, files, notes });
    setSubmitting(false);
    if (error) { toast({ title: 'Submission failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Submitted! AI is evaluating your work…' });
    onSubmitted();
  };

  return (
    <Card className="p-4 space-y-3 border-slate-200">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-600" />
        <h3 className="font-semibold text-sm">{existing?.status === 'evaluated' ? 'Resubmit your work' : 'Submit your work'}</h3>
      </div>

      <div>
        <label className="text-xs font-medium flex items-center gap-1 mb-1"><Github className="h-3 w-3" /> Public GitHub URL</label>
        <Input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/your-username/your-repo" className={!isGitValid ? 'border-destructive' : ''} />
      </div>

      <div>
        <label className="text-xs font-medium flex items-center gap-1 mb-1"><Upload className="h-3 w-3" /> Or upload files (≤5MB each)</label>
        <input
          type="file"
          multiple
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
          className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
          disabled={uploading}
        />
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1">
                <span className="truncate flex items-center gap-1"><FileText className="h-3 w-3 text-slate-400" /> {f.name}</span>
                <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-destructive"><X className="h-3 w-3" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="text-xs font-medium mb-1 block">Notes for the AI reviewer</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional: explain your approach, trade-offs…" />
      </div>

      <Button onClick={handleSubmit} disabled={submitting || uploading} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</> : <><Sparkles className="h-4 w-4 mr-2 text-indigo-300" /> Submit for AI Review</>}
      </Button>
    </Card>
  );
}

function EvaluationReport({ evaluation }: { evaluation: any }) {
  const score = Math.round(evaluation.overall_score || 0);
  const subs = [
    { label: 'Understanding', value: evaluation.understanding_score },
    { label: 'Code Quality', value: evaluation.code_quality_score },
    { label: 'Completeness', value: evaluation.completeness_score },
    { label: 'Outcome Match', value: evaluation.outcome_match_score },
  ];
  return (
    <Card className="p-4 space-y-4 bg-white border-slate-200">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> AI Evaluation</h3>
        <div className="text-right">
          <div className="text-3xl font-extrabold text-slate-900 leading-none">{score}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Overall</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {subs.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-semibold">{Math.round(Number(s.value) || 0)}</span>
            </div>
            <Progress value={Number(s.value) || 0} className="h-1.5" />
          </div>
        ))}
      </div>

      <ListBlock title="Strengths" items={evaluation.strengths} tone="emerald" />
      <ListBlock title="Gaps" items={evaluation.gaps} tone="amber" />
      <ListBlock title="Recommendations" items={evaluation.recommendations} tone="indigo" />

      {evaluation.report_markdown && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-xs text-violet-700 hover:underline">Read full report</summary>
          <div className="prose prose-sm max-w-none mt-2"><ReactMarkdown>{evaluation.report_markdown}</ReactMarkdown></div>
        </details>
      )}
    </Card>
  );
}

function ListBlock({ title, items, tone }: { title: string; items?: string[]; tone: 'emerald' | 'amber' | 'indigo' }) {
  if (!items?.length) return null;
  const cls = { emerald: 'text-emerald-700', amber: 'text-amber-700', indigo: 'text-violet-700' }[tone];
  return (
    <div>
      <h4 className={`text-xs font-bold uppercase tracking-wider mb-1 ${cls}`}>{title}</h4>
      <ul className="space-y-1 text-xs">
        {items.map((s, i) => <li key={i} className="flex gap-1.5"><span className={cls}>•</span><span>{s}</span></li>)}
      </ul>
    </div>
  );
}
