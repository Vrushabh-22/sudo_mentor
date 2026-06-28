import { useEffect, useState } from "react";
import { practiceWorkout } from "@/lib/practiceClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Flame, Trophy, ArrowRight, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

type Slot = {
  pillar_id: string; pillar_slug: string; pillar_name: string; pillar_icon: string; pillar_color: string;
  subtopic_id: string; subtopic_name: string;
  kind: string; time_budget: number;
  item_ids: string[];
  items: { id: string; kind: string; payload: any }[];
};

interface Props { onDone?: () => void }

export function DailyWorkout({ onDone }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<any>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [running, setRunning] = useState(false);
  const [idx, setIdx] = useState(0);
  const [perSlotResult, setPerSlotResult] = useState<Record<number, { score: number; feedback?: string }>>({});
  const [done, setDone] = useState(false);
  const [answerSel, setAnswerSel] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await practiceWorkout({ action: "get_today" });
    setLoading(false);
    if (error) { toast({ title: "Could not load workout", description: error.message, variant: "destructive" }); return; }
    if (!data?.ok) { toast({ title: "No workout", description: data?.error || "no content yet", variant: "destructive" }); return; }
    setWorkout(data.workout); setSlots(data.slots || []);
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!slots.length) return (
    <Card className="p-6 text-center text-sm text-muted-foreground">
      No workout could be assembled. Ask admin to add approved practice items.
    </Card>
  );

  if (done) {
    return (
      <Card className="p-6 text-center bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white border-0 shadow-xl">
        <Trophy className="h-12 w-12 mx-auto mb-2" />
        <h2 className="text-2xl font-bold">Workout complete!</h2>
        <div className="text-5xl font-extrabold mt-3">+{totalXp} XP</div>
        <p className="text-sm opacity-90 mt-1">{total} slots · Career Fitness updated</p>
        <Button onClick={() => { setDone(false); setIdx(0); setPerSlotResult({}); load(); }} variant="secondary" className="mt-4">
          See today's progress
        </Button>
      </Card>
    );
  }

  if (!running) {
    const totalMin = Math.round(slots.reduce((s, x) => s + (x.time_budget || 180), 0) / 60);
    return (
      <div className="space-y-4">
        <Card className="p-5 bg-gradient-to-br from-orange-500 to-rose-500 text-white border-0 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-semibold opacity-90"><Flame className="h-4 w-4" /> TODAY'S CAREER WORKOUT</div>
          <h2 className="text-2xl font-bold mt-1">{totalMin} min · {total} slots</h2>
          <p className="text-sm opacity-90 mt-1">Stay match-fit. Daily reps build the score that recruiters see.</p>
        </Card>
        <ul className="space-y-2">
          {slots.map((s, i) => (
            <li key={i} className="flex items-center gap-3 p-3 rounded-xl border bg-white">
              <span className="text-2xl">{s.pillar_icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{s.pillar_name}</div>
                <div className="text-xs text-muted-foreground truncate">{s.subtopic_name} · {Math.round(s.time_budget / 60)} min · {s.kind}</div>
              </div>
            </li>
          ))}
        </ul>
        <Button onClick={() => setRunning(true)} className="w-full h-12 bg-violet-600 hover:bg-violet-700">
          Start workout <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    );
  }

  const slot = slots[idx];
  const item = slot.items[0];
  const result = perSlotResult[idx];

  return (
    <div className="space-y-3">
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
