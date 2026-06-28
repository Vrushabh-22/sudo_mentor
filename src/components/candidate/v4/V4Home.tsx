import { useState } from 'react';
import { V4Bootstrap } from '@/pages/CandidatePortalV4';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Sparkles, GraduationCap, Trophy, Briefcase, ArrowRight, Flame, Target, Share2 } from 'lucide-react';
import { ShareSheet } from './share/ShareSheet';
import { WhatsAppOptInCard } from '@/components/candidate/WhatsAppOptInCard';
import { FitnessScoreCard } from './practice/FitnessScoreCard';


interface Props {
  bootstrap: V4Bootstrap;
  onNavigate: (tab: any) => void;
}

export function V4Home({ bootstrap, onNavigate }: Props) {
  const c = bootstrap.candidate;
  const completeness = c.profile_completeness || 0;
  const remaining = bootstrap.daily_limit - bootstrap.today_attempts;
  const [shareOpen, setShareOpen] = useState(false);
  const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'alphaRecrewt Candidate';

  return (
    <div className="space-y-4">
      {/* Greeting hero */}
      <Card className="relative p-5 bg-gradient-to-br from-violet-100 via-white to-fuchsia-50 ring-1 ring-violet-100 border-0 shadow-sm overflow-hidden">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-violet-500/5 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-violet-600 font-semibold">Welcome back</p>
            <h1 className="text-2xl font-bold mt-1 text-slate-900">{c.first_name || 'Hello'} 👋</h1>
            <p className="text-sm text-slate-600 mt-1">
              {c.stream ? `${c.stream} · ${c.institution || 'Campus'}` : 'Tell your mentor your stream to begin'}
            </p>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-1 text-xs font-semibold bg-white ring-1 ring-orange-200 text-orange-600 rounded-full px-2 py-1">
              <Flame className="h-3.5 w-3.5" /> {c.streak_days || 0} day streak
            </div>
            <div className="text-3xl font-extrabold mt-2 text-violet-600">{c.xp_total || 0}</div>
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">XP earned</div>
          </div>
        </div>
        <Button
          onClick={() => setShareOpen(true)}
          size="sm"
          variant="outline"
          className="mt-4 w-full bg-white/70 backdrop-blur border-violet-200 text-violet-700 hover:bg-white"
        >
          <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share my progress
        </Button>
      </Card>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        data={{
          kind: 'profile_summary',
          candidate_name: fullName,
          photo_url: c.photo_url || null,
          institution: c.institution || c.stream || null,
          headline: 'My alphaRecrewt journey',
          big_stat: String(c.xp_total || 0),
          big_stat_label: 'XP earned',
          sub_stats: [
            { label: 'Day streak', value: String(c.streak_days || 0) },
            { label: 'Profile', value: `${completeness}%` },
            { label: 'Today', value: `${bootstrap.today_attempts}/${bootstrap.daily_limit}` },
          ],
          date_label: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        }}
      />

      {/* Profile completeness */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-sm">Profile completeness</h3>
            <p className="text-xs text-muted-foreground">A complete profile unlocks more recommendations</p>
          </div>
          <span className="text-lg font-bold text-violet-600">{completeness}%</span>
        </div>
        <Progress value={completeness} className="h-2" />
        {completeness < 80 && (
          <Button onClick={() => onNavigate('mentor')} size="sm" className="w-full mt-3 bg-violet-600 hover:bg-violet-700">
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Ask mentor to help complete it
          </Button>
        )}
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onNavigate('practice')} className="text-left p-4 rounded-2xl bg-white ring-1 ring-slate-200 hover:ring-violet-200 hover:shadow-md transition-all">
          <GraduationCap className="h-5 w-5 text-emerald-600 mb-2" />
          <div className="font-semibold text-sm text-slate-900">Practice Quiz</div>
          <div className="text-xs text-slate-500 mt-1">{remaining}/2 left today</div>
        </button>
        <button onClick={() => onNavigate('mentor')} className="text-left p-4 rounded-2xl bg-white ring-1 ring-slate-200 hover:ring-violet-200 hover:shadow-md transition-all">
          <Sparkles className="h-5 w-5 text-violet-600 mb-2" />
          <div className="font-semibold text-sm text-slate-900">Ask Mentor</div>
          <div className="text-xs text-slate-500 mt-1">Skills, prep, learning paths</div>
        </button>
        <button onClick={() => onNavigate('leaderboard')} className="text-left p-4 rounded-2xl bg-white ring-1 ring-slate-200 hover:ring-violet-200 hover:shadow-md transition-all">
          <Trophy className="h-5 w-5 text-amber-600 mb-2" />
          <div className="font-semibold text-sm text-slate-900">Campus Rank</div>
          <div className="text-xs text-slate-500 mt-1">{c.institution || 'Tenant'} leaderboard</div>
        </button>
        <button onClick={() => onNavigate('jobs')} className="text-left p-4 rounded-2xl bg-white ring-1 ring-slate-200 hover:ring-violet-200 hover:shadow-md transition-all">
          <Briefcase className="h-5 w-5 text-sky-600 mb-2" />
          <div className="font-semibold text-sm text-slate-900">My Roles</div>
          <div className="text-xs text-slate-500 mt-1">Track applications</div>
        </button>
      </div>

      {(c as any).whatsapp_updates_enabled && (
        <WhatsAppOptInCard
          candidateId={(c as any).id}
          initialOptIn={!!(c as any).whatsapp_opt_in}
          initialPhone={(c as any).whatsapp_phone || ''}
        />
      )}



      <Card className="p-4 bg-white ring-1 ring-slate-200 border-0">
        <div className="flex items-start gap-3">
          <Target className="h-5 w-5 text-orange-500 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm">Today's mission</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Take 1 practice quiz and chat with your mentor for at least one prep tip. Earn 30+ XP.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onNavigate('practice')}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
