import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, GraduationCap, Sparkles, Recycle } from 'lucide-react';

interface Props {
  skill: string;
  tags: string[];
  onOpenPath: (pathId: string) => void;
}

export function LPSuggestionCard({ skill, tags, onOpenPath }: Props) {
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState<any>(null);
  const [reused, setReused] = useState(false);

  async function build() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('mentor-learning-path', {
      body: { action: 'find_or_create', skill, tags },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: 'Could not build path', description: data?.error || error?.message, variant: 'destructive' });
      return;
    }
    setPath(data.path);
    setReused(!!data.reused);
  }

  if (path) {
    const totalVideos = (path.modules || []).reduce((s: number, m: any) => s + (m.videos?.length || 0), 0);
    return (
      <div className="mt-2 bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-200 rounded-xl p-3">
        <div className="flex items-center gap-2 text-xs text-violet-700 mb-1">
          {reused ? <><Recycle className="h-3 w-3" /> Curated path · reused from library</> : <><Sparkles className="h-3 w-3" /> Freshly curated for you</>}
        </div>
        <div className="font-semibold text-sm">{path.title}</div>
        <div className="text-xs text-slate-600 mt-1">{path.description}</div>
        <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
          <span>{path.modules?.length || 0} modules</span>·<span>{totalVideos} videos</span>·<span>{path.estimated_hours}h</span>
        </div>
        <Button size="sm" onClick={() => onOpenPath(path.id)} className="w-full mt-2 bg-violet-600 hover:bg-violet-700">
          Start learning
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 bg-white border border-violet-200 rounded-xl p-3">
      <div className="flex items-start gap-2">
        <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
          <GraduationCap className="h-4 w-4 text-violet-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Curated path: {skill}</div>
          <div className="text-[11px] text-slate-500">Hand-picked YouTube tutorials (IBM, MIT, freeCodeCamp, …)</div>
        </div>
      </div>
      <Button size="sm" onClick={build} disabled={loading} className="w-full mt-2 bg-violet-600 hover:bg-violet-700">
        {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Curating…</> : 'Build my path'}
      </Button>
    </div>
  );
}
