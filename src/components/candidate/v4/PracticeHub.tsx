import { useState } from 'react';
import { V4Bootstrap } from '@/pages/CandidatePortalV4';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { invokeV4 } from '@/lib/candidatePortalV4Client';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Trophy, Share2 } from 'lucide-react';
import { MyLearningPaths } from './MyLearningPaths';
import { LearningPathView } from './LearningPathView';
import { ShareSheet } from './share/ShareSheet';

interface Props { bootstrap: V4Bootstrap; onDone: () => void }

interface Q { id: string; question_text: string; options: any; difficulty?: string; skill?: string }

const DEFAULT_DOMAINS = [
  { domain: 'Aptitude', emoji: '🧮', color: 'from-amber-500 to-orange-500' },
  { domain: 'Reasoning', emoji: '🧠', color: 'from-violet-500 to-purple-500' },
  { domain: 'Verbal', emoji: '📝', color: 'from-emerald-500 to-teal-500' },
  { domain: 'Programming', emoji: '💻', color: 'from-sky-500 to-blue-500' },
  { domain: 'DBMS', emoji: '🗄️', color: 'from-rose-500 to-pink-500' },
  { domain: 'Data Science', emoji: '📊', color: 'from-fuchsia-500 to-violet-500' },
];

export function PracticeHub({ bootstrap, onDone }: Props) {
  const [running, setRunning] = useState<{ attemptId: string; domain: string; questions: Q[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; xp: number; domain: string } | null>(null);
  const [tab, setTab] = useState<'quiz' | 'paths'>('quiz');
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const remaining = bootstrap.daily_limit - bootstrap.today_attempts;

  async function start(domain: string) {
    if (remaining <= 0) {
      toast({ title: 'Daily limit reached', description: 'Come back tomorrow for more practice!', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { data, error } = await invokeV4<{ attempt_id: string; questions: Q[] }>({ action: 'start_practice', domain });
    setLoading(false);
    if (error) { toast({ title: 'Could not start', description: error.message, variant: 'destructive' }); return; }
    if (!data?.questions?.length) { toast({ title: 'No questions found', description: `No ${domain} questions available yet. Try another domain.`, variant: 'destructive' }); return; }
    setRunning({ attemptId: data.attempt_id, domain, questions: data.questions });
    setAnswers({});
    setResult(null);
  }

  async function submit() {
    if (!running) return;
    setLoading(true);
    const { data, error } = await invokeV4<{ score: number; total: number; xp_awarded: number }>({ action: 'submit_practice', attempt_id: running.attemptId, answers });
    setLoading(false);
    if (error || !data) { toast({ title: 'Submit failed', description: error?.message || 'Unknown error', variant: 'destructive' }); return; }
    setResult({ score: data.score, total: data.total, xp: data.xp_awarded, domain: running.domain });
    onDone();
  }

  if (result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white border-0 shadow-xl">
          <Trophy className="h-12 w-12 mx-auto mb-2" />
          <h2 className="text-2xl font-bold">{pct >= 70 ? 'Awesome work!' : 'Good effort!'}</h2>
          <p className="text-sm opacity-90 mt-1">{result.domain}</p>
          <div className="text-5xl font-extrabold mt-4">{result.score}<span className="text-2xl opacity-70">/{result.total}</span></div>
          <div className="mt-2 text-sm">+{result.xp} XP earned</div>
        </Card>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setShareOpen(true)} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90">
            <Share2 className="h-4 w-4 mr-1" /> Share win
          </Button>
          <Button onClick={() => { setRunning(null); setResult(null); }} variant="outline">
            Back to practice
          </Button>
        </div>

        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          data={{
            kind: 'quiz_result',
            candidate_name: `${bootstrap.candidate.first_name || ''} ${bootstrap.candidate.last_name || ''}`.trim() || 'alphaRecrewt Candidate',
            photo_url: bootstrap.candidate.photo_url || null,
            institution: bootstrap.candidate.institution || bootstrap.candidate.stream || null,
            headline: `${result.domain} Quiz`,
            big_stat: `${result.score}/${result.total}`,
            big_stat_label: `${pct}% accuracy`,
            sub_stats: [
              { label: 'XP earned', value: `+${result.xp}` },
              { label: 'Streak', value: String(bootstrap.candidate.streak_days || 0) },
              { label: 'Total XP', value: String(bootstrap.candidate.xp_total || 0) },
            ],
            date_label: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          }}
        />
      </div>
    );
  }

  if (running) {
    const allAnswered = running.questions.every((q) => answers[q.id]);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between sticky top-14 bg-gradient-to-br from-slate-50 to-violet-50/40 z-10 py-2">
          <button onClick={() => setRunning(null)} className="flex items-center gap-1 text-sm text-violet-700"><ArrowLeft className="h-4 w-4" /> Quit</button>
          <span className="text-xs text-muted-foreground">{Object.keys(answers).length}/{running.questions.length} answered</span>
        </div>
        {running.questions.map((q, idx) => {
          const opts = Array.isArray(q.options) ? q.options : [];
          return (
            <Card key={q.id} className="p-4">
              <div className="text-xs text-violet-600 font-semibold mb-1">Q{idx + 1}</div>
              <div className="text-sm font-medium mb-3 whitespace-pre-wrap">{q.question_text}</div>
              <div className="space-y-2">
                {opts.map((opt: any, i: number) => {
                  const value = typeof opt === 'string' ? opt : (opt.text || opt.value || JSON.stringify(opt));
                  const selected = answers[q.id] === value;
                  return (
                    <button
                      key={i}
                      onClick={() => setAnswers({ ...answers, [q.id]: value })}
                      className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${selected ? 'border-violet-500 bg-violet-50 text-violet-900' : 'border-slate-200 bg-white hover:border-violet-300'}`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
        <Button onClick={submit} disabled={!allAnswered || loading} className="w-full h-12 bg-violet-600 hover:bg-violet-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Submit answers
        </Button>
      </div>
    );
  }

  if (openPath) {
    return <LearningPathView pathId={openPath} onBack={() => setOpenPath(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-white border border-violet-100 rounded-full p-1 w-fit">
        {(['quiz', 'paths'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${tab === t ? 'bg-violet-600 text-white shadow' : 'text-slate-600'}`}>
            {t === 'quiz' ? 'Daily Quiz' : 'Learning Paths'}
          </button>
        ))}
      </div>

      {tab === 'paths' ? (
        <MyLearningPaths onOpen={(id) => setOpenPath(id)} />
      ) : (
        <>
          <Card className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">Daily Practice</h2>
                <p className="text-xs text-muted-foreground">10 questions · earns up to 30 XP per quiz</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold text-emerald-700">{remaining}<span className="text-sm opacity-60">/{bootstrap.daily_limit}</span></div>
                <div className="text-[10px] uppercase text-emerald-700/70">left today</div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            {DEFAULT_DOMAINS.map((d) => (
              <button
                key={d.domain}
                onClick={() => start(d.domain)}
                disabled={loading || remaining <= 0}
                className={`text-left p-4 rounded-2xl bg-gradient-to-br ${d.color} text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50`}
              >
                <div className="text-2xl mb-1">{d.emoji}</div>
                <div className="font-semibold text-sm">{d.domain}</div>
                <div className="text-[10px] opacity-80 mt-0.5">10 questions · 5-10 min</div>
              </button>
            ))}
          </div>

          {remaining <= 0 && (
            <Card className="p-4 bg-amber-50 border-amber-200 text-center text-sm text-amber-900">
              You've used today's 2 quizzes. Streaks build by coming back daily 🔥
            </Card>
          )}
        </>
      )}
    </div>
  );
}
