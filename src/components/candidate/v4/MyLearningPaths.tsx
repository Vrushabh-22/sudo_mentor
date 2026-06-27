import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, GraduationCap, ChevronRight } from 'lucide-react';

interface Props { onOpen: (pathId: string) => void }

export function MyLearningPaths({ onOpen }: Props) {
  const [loading, setLoading] = useState(true);
  const [paths, setPaths] = useState<any[]>([]);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    const { data } = await supabase.functions.invoke('mentor-learning-path', { body: { action: 'list_my_paths' } });
    setPaths(data?.paths || []);
    setLoading(false);
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></div>;

  if (!paths.length) {
    return (
      <div className="bg-white border border-violet-100 rounded-2xl p-6 text-center">
        <GraduationCap className="h-10 w-10 text-violet-400 mx-auto mb-2" />
        <div className="font-semibold text-sm">No learning paths yet</div>
        <div className="text-xs text-slate-500 mt-1">Ask AlphaMentor for a path on any topic — Kubernetes, React, Power BI, anything.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {paths.map((e) => {
        const p = e.path;
        if (!p) return null;
        return (
          <button key={e.enrollment_id} onClick={() => onOpen(p.id)}
            className="w-full text-left bg-white border border-violet-100 rounded-2xl p-3 hover:shadow-md transition-all flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{p.title}</div>
              <div className="text-[11px] text-slate-500">{p.level} · {p.estimated_hours}h · {e.completed_videos}/{e.total_videos} done</div>
              <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${e.progress_pct}%` }} />
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </button>
        );
      })}
    </div>
  );
}
