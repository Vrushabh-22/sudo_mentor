import { useEffect, useState } from "react";
import { practiceWorkout } from "@/lib/practiceClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Flame, Trophy, ArrowRight, CheckCircle2, ArrowLeft, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { ShareSheet } from "../share/ShareSheet";
import type { V4Bootstrap } from "@/pages/CandidatePortalV4";

type Pillar = {
  id: string; slug: string; name: string; icon: string; color: string | null;
  item_count: number; is_stream_aware?: boolean;
};

type Slot = {
  pillar_id: string; pillar_slug: string; pillar_name: string; pillar_icon: string; pillar_color: string;
  subtopic_id: string; subtopic_name: string;
  kind: string; time_budget: number;
  item_ids: string[];
  items: { id: string; kind: string; payload: any }[];
};

const FALLBACK_GRADIENTS = [
  "from-amber-500 to-orange-500",
  "from-violet-500 to-purple-500",
  "from-emerald-500 to-teal-500",
  "from-sky-500 to-blue-500",
  "from-rose-500 to-pink-500",
  "from-fuchsia-500 to-violet-500",
  "from-indigo-500 to-blue-600",
  "from-lime-500 to-emerald-500",
];

function gradientFor(p: Pillar, i: number) {
  if (p.color && p.color.includes("from-")) return p.color;
  return FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length];
}

interface Props { bootstrap?: V4Bootstrap; onDone?: () => void }

export function DailyWorkout({ bootstrap, onDone }: Props) {
  const { toast } = useToast();

  // Landing state
  const [landingLoading, setLandingLoading] = useState(true);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [todayAttempts, setTodayAttempts] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(2);

  // Running state
  const [starting, setStarting] = useState(false);
  const [workout, setWorkout] = useState<any>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [idx, setIdx] = useState(0);
  const [perSlotResult, setPerSlotResult] = useState<Record<number, { score: number; feedback?: string }>>({});
  const [answerSel, setAnswerSel] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [activePillar, setActivePillar] = useState<Pillar | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => { loadLanding(); }, []);

  async function loadLanding() {
    setLandingLoading(true);
    const { data, error } = await practiceWorkout<{ pillars: Pillar[]; today_attempts: number; daily_limit: number }>({ action: "list_available_pillars" });
    setLandingLoading(false);
    if (error) { toast({ title: "Couldn't load workouts", description: error.message, variant: "destructive" }); return; }
    setPillars(data?.pillars || []);
    setTodayAttempts(data?.today_attempts || 0);
    setDailyLimit(data?.daily_limit || 2);
  }

  const remaining = Math.max(0, dailyLimit - todayAttempts);

  async function startPillar(p: Pillar) {
    if (remaining <= 0) {
      toast({ title: "Daily limit reached", description: "Come back tomorrow for the next workout!", variant: "destructive" });
      return;
    }
    setStarting(true);
    const { data, error } = await practiceWorkout<{ ok: boolean; workout: any; slots: Slot[] }>({ action: "get_today", pillar_id: p.id });
    setStarting(false);
    if (error) {
      toast({ title: "Couldn't start workout", description: error.message, variant: "destructive" });
      return;
    }
    if (!data?.slots?.length) {
      console.warn("[DailyWorkout] empty slots for pillar", p, data);
      toast({ title: "No content for this workout yet", description: "Try another pillar or ask admin to add items.", variant: "destructive" });
      return;
    }
    setActivePillar(p);
    setWorkout(data.workout);
    setSlots(data.slots);
    setIdx(0);
    setPerSlotResult({});
    setAnswerSel(null); setAnswerText("");
    setDone(false);
  }

  const total = slots.length;
  const totalXp = Object.values(perSlotResult).reduce((s, r) => s + Math.round((r.score / 100) * 20), 0);

  async function submitCurrent() {
    const slot = slots[idx]; if (!slot || !slot.items?.length) return;
    const item = slot.items[0];
    setSubmitting(true);
    const answer = slot.kind === "mcq" ? { selected_index: answerSel } : { text: answerText };
    const { data, error } = await practiceWorkout<{ score: number; is_correct: boolean; feedback: any }>({
      action: "submit_attempt",
      workout_id: workout.id, slot_index: idx, item_id: item.id,
      pillar_id: slot.pillar_id, subtopic_id: slot.subtopic_id, kind: slot.kind, answer,
    });
    setSubmitting(false);
    if (error || !data) { toast({ title: "Submit failed", description: error?.message, variant: "destructive" }); return; }
    setPerSlotResult((r) => ({ ...r, [idx]: { score: data.score, feedback: data.feedback?.explanation } }));
  }

  function next() {
    setAnswerSel(null); setAnswerText("");
    if (idx + 1 >= total) finish();
    else setIdx(idx + 1);
  }

  async function finish() {
    const xp = Object.values(perSlotResult).reduce((s, r) => s + Math.round((r.score / 100) * 20), 0);
    await practiceWorkout({ action: "finish_workout", workout_id: workout.id, total_xp: xp });
    setDone(true);
    onDone?.();
  }

  function backToLanding() {
    setWorkout(null); setSlots([]); setActivePillar(null); setDone(false);
    loadLanding();
  }

  // -------- FINISH SCREEN --------
  if (done && activePillar) {
    const pct = total ? Math.round((totalXp / (total * 20)) * 100) : 0;
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white border-0 shadow-xl">
          <Trophy className="h-12 w-12 mx-auto mb-2" />
          <h2 className="text-2xl font-bold">Workout complete!</h2>
          <p className="text-sm opacity-90 mt-1">{activePillar.icon} {activePillar.name}</p>
          <div className="text-5xl font-extrabold mt-4">+{totalXp}<span className="text-2xl opacity-70"> XP</span></div>
          <div className="mt-2 text-sm opacity-90">{pct}% effort · Career Fitness updated</div>
        </Card>
        <div className="grid grid-cols-2 gap-2">
          {bootstrap && (
            <Button onClick={() => setShareOpen(true)} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90">
              <Share2 className="h-4 w-4 mr-1" /> Share win
            </Button>
          )}
          <Button onClick={backToLanding} variant="outline" className={bootstrap ? "" : "col-span-2"}>
            Back to workouts
          </Button>
        </div>
        {bootstrap && (
          <ShareSheet
            open={shareOpen}
            onOpenChange={setShareOpen}
            data={{
              kind: "quiz_result",
              candidate_name: `${bootstrap.candidate.first_name || ""} ${bootstrap.candidate.last_name || ""}`.trim() || "Sudo Mentor Candidate",
              photo_url: bootstrap.candidate.photo_url || null,
              institution: bootstrap.candidate.institution || bootstrap.candidate.stream || null,
              headline: `${activePillar.name} Workout`,
              big_stat: `+${totalXp} XP`,
              big_stat_label: `${pct}% effort`,
              sub_stats: [
                { label: "Slots", value: String(total) },
                { label: "Streak", value: String(bootstrap.candidate.streak_days || 0) },
                { label: "Total XP", value: String(bootstrap.candidate.xp_total || 0) },
              ],
              date_label: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
            }}
          />
        )}
      </div>
    );
  }

  // -------- RUNNING SCREEN --------
  if (workout && slots.length > 0 && activePillar) {
    const slot = slots[idx];
    const item = slot.items[0];
    const result = perSlotResult[idx];
    return (
      <div className="space-y-3">
        <button onClick={backToLanding} className="flex items-center gap-1 text-sm text-violet-700">
          <ArrowLeft className="h-4 w-4" /> Quit workout
        </button>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{slot.pillar_icon} {slot.pillar_name} · {slot.subtopic_name}</span>
            <span>{idx + 1} / {total}</span>
          </div>
          <Progress value={((idx + (result ? 1 : 0)) / total) * 100} className="h-1.5" />
        </div>

        <Card className="p-4">
          {slot.kind === "mcq" ? (
            <>
              <div className="text-sm font-medium mb-3 whitespace-pre-wrap">{item?.payload?.question}</div>
              <div className="space-y-2">
                {(item?.payload?.options || []).map((opt: string, i: number) => {
                  const selected = answerSel === i;
                  const isCorrect = result && i === item.payload.correct_index;
                  const isPickedWrong = result && selected && i !== item.payload.correct_index;
                  return (
                    <button key={i} disabled={!!result}
                      onClick={() => setAnswerSel(i)}
                      className={`w-full text-left p-3 rounded-xl border text-sm transition ${
                        isCorrect ? "border-emerald-500 bg-emerald-50 text-emerald-900" :
                        isPickedWrong ? "border-rose-500 bg-rose-50 text-rose-900" :
                        selected ? "border-violet-500 bg-violet-50 text-violet-900" :
                        "border-slate-200 bg-white hover:border-violet-300"}`}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium mb-3 whitespace-pre-wrap">{item?.payload?.prompt || item?.payload?.question}</div>
              <textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} disabled={!!result}
                className="w-full min-h-[140px] p-3 rounded-xl border text-sm" placeholder="Type your answer…" />
            </>
          )}

          {result && (
            <div className="mt-3 p-3 rounded-lg bg-muted text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Score: {Math.round(result.score)}/100
              </div>
              {result.feedback && <p className="text-xs text-muted-foreground mt-1">{result.feedback}</p>}
            </div>
          )}
        </Card>

        {!result ? (
          <Button onClick={submitCurrent} disabled={submitting || (slot.kind === "mcq" ? answerSel === null : !answerText.trim())} className="w-full h-12 bg-violet-600 hover:bg-violet-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Submit
          </Button>
        ) : (
          <Button onClick={next} className="w-full h-12 bg-violet-600 hover:bg-violet-700">
            {idx + 1 >= total ? "Finish workout" : "Next slot"} <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    );
  }

  // -------- LANDING --------
  if (landingLoading || starting) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 bg-gradient-to-br from-orange-500 to-rose-500 text-white border-0 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-semibold opacity-90">
          <Flame className="h-4 w-4" /> TODAY'S CAREER WORKOUT
        </div>
        <div className="flex items-end justify-between mt-1">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold">Stay match-fit.</h2>
            <p className="text-sm opacity-90 mt-1">Daily reps build the confidence recruiters can see — 5–10 minutes, that's it.</p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <div className="text-3xl font-extrabold leading-none">{remaining}<span className="text-lg opacity-70">/{dailyLimit}</span></div>
            <div className="text-[10px] uppercase opacity-80 mt-1">left today</div>
          </div>
        </div>
      </Card>

      {pillars.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          <div className="text-3xl mb-2">🛠️</div>
          <div className="font-semibold text-slate-800">New workouts arrive soon</div>
          <div className="mt-1">Your admin is loading question banks. Check back shortly — this is where your daily reps will live.</div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {pillars.map((p, i) => (
              <button
                key={p.id}
                onClick={() => startPillar(p)}
                disabled={remaining <= 0}
                className={`text-left p-4 rounded-2xl bg-gradient-to-br ${gradientFor(p, i)} text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="text-2xl mb-1">{p.icon || "💪"}</div>
                <div className="font-semibold text-sm leading-tight">{p.name}</div>
                <div className="text-[10px] opacity-80 mt-1">{p.item_count} question{p.item_count === 1 ? "" : "s"} · 5–10 min</div>
              </button>
            ))}
          </div>

          {remaining <= 0 && (
            <Card className="p-4 bg-amber-50 border-amber-200 text-center text-sm text-amber-900">
              You've hit today's {dailyLimit} workouts. Streaks build by coming back daily 🔥
            </Card>
          )}

          <Card className="p-4 bg-white border-violet-100">
            <div className="text-xs font-semibold text-violet-700 mb-1">Why daily workouts?</div>
            <div className="text-sm text-slate-600">A few reps every day beats a cram session before an interview. Each workout nudges your Career Fitness Score — the number recruiters and mentors see first.</div>
          </Card>
        </>
      )}
    </div>
  );
}
