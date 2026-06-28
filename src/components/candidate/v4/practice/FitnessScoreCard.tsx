import { useEffect, useState } from "react";
import { practiceWorkout } from "@/lib/practiceClient";
import { Card } from "@/components/ui/card";
import { Loader2, Activity } from "lucide-react";

type Pillar = { id: string; name: string; icon: string | null; score: number; attempts: number };

export function FitnessScoreCard({ onOpenPractice }: { onOpenPractice?: () => void }) {
  const [data, setData] = useState<{ overall: number; pillars: Pillar[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    practiceWorkout<{ overall: number; pillars: Pillar[] }>({ action: "get_fitness" })
      .then(({ data }) => setData(data ? { overall: data.overall || 0, pillars: data.pillars || [] } : null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Card className="p-4"><Loader2 className="h-4 w-4 animate-spin" /></Card>;
  if (!data) return null;

  const overall = data.overall;
  const top3 = [...data.pillars].sort((a, b) => b.score - a.score).slice(0, 3);
  const bottom3 = [...data.pillars].sort((a, b) => a.score - b.score).slice(0, 3);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-violet-600" /> <h3 className="font-semibold text-sm">Career Fitness Score</h3></div>
        {onOpenPractice && <button onClick={onOpenPractice} className="text-xs text-violet-600 font-medium">Train now →</button>}
      </div>

      <div className="flex items-end gap-3 mb-4">
        <div className="text-5xl font-extrabold text-violet-700">{Math.round(overall)}<span className="text-xl opacity-50">/100</span></div>
        <div className="text-xs text-muted-foreground pb-2">Updated after every workout</div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-emerald-700 mb-1">Strongest</div>
          {top3.map((p) => (
            <div key={p.id} className="flex justify-between py-0.5">
              <span className="truncate">{p.icon} {p.name}</span>
              <span className="font-semibold">{Math.round(p.score)}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-rose-700 mb-1">Train next</div>
          {bottom3.map((p) => (
            <div key={p.id} className="flex justify-between py-0.5">
              <span className="truncate">{p.icon} {p.name}</span>
              <span className="font-semibold">{Math.round(p.score)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
