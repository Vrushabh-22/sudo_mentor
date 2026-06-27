import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, Play, Clock, Loader2, Star, LayoutGrid, List, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props { pathId: string; onBack: () => void }

interface Video { youtube_id: string; title: string; channel: string; duration_sec: number; thumbnail: string }
interface Module { title: string; summary: string; videos: Video[] }

type ViewMode = 'comfortable' | 'compact';
const VIEW_KEY = 'v4_lp_view';

export function LearningPathView({ pathId, onBack }: Props) {
  const [path, setPath] = useState<any>(null);
  const [progress, setProgress] = useState<Record<string, { watched_sec: number; completed: boolean }>>({});
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'comfortable';
    return (localStorage.getItem(VIEW_KEY) as ViewMode) || 'comfortable';
  });
  const tickRef = useRef<number>(0);

  useEffect(() => { load(); }, [pathId]);
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch {} }, [view]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('mentor-learning-path', {
      body: { action: 'get_path', path_id: pathId },
    });
    setLoading(false);
    if (error || data?.error) { toast({ title: 'Could not load path', description: data?.error || error?.message, variant: 'destructive' }); return; }
    setPath(data.path);
    const map: Record<string, any> = {};
    for (const p of data.progress || []) map[p.video_id] = p;
    setProgress(map);
  }

  async function markProgress(video: Video, watched: number) {
    const { data } = await supabase.functions.invoke('mentor-learning-path', {
      body: { action: 'mark_progress', path_id: pathId, video_id: video.youtube_id, watched_sec: watched, duration_sec: video.duration_sec },
    });
    if (data?.completed && !progress[video.youtube_id]?.completed) {
      toast({ title: '+15 XP', description: `${video.title} completed!` });
      setProgress((p) => ({ ...p, [video.youtube_id]: { watched_sec: watched, completed: true } }));
    } else {
      setProgress((p) => ({ ...p, [video.youtube_id]: { watched_sec: Math.max(p[video.youtube_id]?.watched_sec || 0, watched), completed: !!p[video.youtube_id]?.completed } }));
    }
  }

  useEffect(() => {
    if (!activeVideo) return;
    const id = window.setInterval(() => {
      tickRef.current += 20;
      const cur = progress[activeVideo.youtube_id]?.watched_sec || 0;
      const next = Math.min(cur + 20, activeVideo.duration_sec);
      markProgress(activeVideo, next);
    }, 20000);
    return () => { window.clearInterval(id); tickRef.current = 0; };
  }, [activeVideo]);

  async function rate(stars: number) {
    await supabase.functions.invoke('mentor-learning-path', { body: { action: 'rate', path_id: pathId, rating: stars } });
    toast({ title: 'Thanks for rating!' });
  }

  function markCompleteNow() {
    if (!activeVideo) return;
    markProgress(activeVideo, activeVideo.duration_sec);
  }

  if (loading || !path) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>;
  }

  const totalVideos = (path.modules || []).reduce((s: number, m: any) => s + (m.videos?.length || 0), 0);
  const completedCount = Object.values(progress).filter((p: any) => p.completed).length;
  const pct = totalVideos ? Math.round((completedCount / totalVideos) * 100) : 0;

  let lessonCounter = 0;
  const numberedModules = (path.modules || []).map((m: Module) => ({
    ...m,
    videos: (m.videos || []).map((v) => ({ ...v, _lesson: ++lessonCounter })),
  }));

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-violet-700 font-medium hover:text-violet-900 transition">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="bg-gradient-to-br from-violet-600 via-violet-500 to-fuchsia-600 text-white rounded-2xl p-5 shadow-xl shadow-violet-200/50">
        <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">{path.level} · {path.estimated_hours}h</div>
        <h2 className="text-2xl font-bold mt-1 leading-tight">{path.title}</h2>
        {path.description && <p className="text-sm opacity-90 mt-2 max-w-3xl">{path.description}</p>}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 bg-white/20 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold whitespace-nowrap">{completedCount}/{totalVideos}</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="text-xs text-muted-foreground font-medium">
          {numberedModules.length} module{numberedModules.length === 1 ? '' : 's'} · {totalVideos} lesson{totalVideos === 1 ? '' : 's'}
        </div>
        <div className="inline-flex rounded-lg bg-violet-50 p-0.5 border border-violet-100">
          <button
            onClick={() => setView('comfortable')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition',
              view === 'comfortable' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-violet-700'
            )}
            aria-label="Comfortable view"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Comfortable
          </button>
          <button
            onClick={() => setView('compact')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition',
              view === 'compact' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-violet-700'
            )}
            aria-label="Compact view"
          >
            <List className="h-3.5 w-3.5" /> Compact
          </button>
        </div>
      </div>

      {activeVideo && (
        <div className="sticky top-16 z-30 -mx-1 px-1">
          <div className="rounded-2xl overflow-hidden bg-black aspect-video shadow-2xl ring-1 ring-violet-200">
            <iframe
              key={activeVideo.youtube_id}
              src={`https://www.youtube.com/embed/${activeVideo.youtube_id}?autoplay=1&rel=0`}
              title={activeVideo.title}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 bg-white rounded-xl border border-violet-100 px-3 py-2">
            <div className="text-xs font-semibold truncate flex-1">{activeVideo.title}</div>
            <Button size="sm" variant="outline" onClick={markCompleteNow} className="h-7 text-[11px]">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Mark complete
            </Button>
            <button onClick={() => setActiveVideo(null)} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Close player">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {numberedModules.map((mod: any, mi: number) => {
          const modDone = (mod.videos || []).filter((v: any) => progress[v.youtube_id]?.completed).length;
          const modTotal = (mod.videos || []).length;
          return (
            <section key={mi}>
              <div className="flex items-end justify-between mb-3 px-1">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-violet-600 font-bold">Module {mi + 1}</div>
                  <h3 className="font-bold text-base sm:text-lg leading-tight mt-0.5">{mod.title}</h3>
                  {mod.summary && <p className="text-xs text-slate-600 mt-1 max-w-2xl">{mod.summary}</p>}
                </div>
                <div className="text-xs font-semibold text-slate-500 whitespace-nowrap pl-3">
                  {modDone} / {modTotal}
                </div>
              </div>

              {view === 'comfortable' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(mod.videos || []).map((v: any) => {
                    const done = progress[v.youtube_id]?.completed;
                    const isActive = activeVideo?.youtube_id === v.youtube_id;
                    return (
                      <div
                        key={v.youtube_id}
                        className={cn(
                          'group bg-white rounded-2xl border overflow-hidden flex flex-col transition-all hover:shadow-lg',
                          isActive ? 'border-violet-400 ring-2 ring-violet-300 shadow-lg' : 'border-violet-100 hover:border-violet-300'
                        )}
                      >
                        <button
                          onClick={() => setActiveVideo(v)}
                          className="relative aspect-video bg-slate-900 overflow-hidden"
                        >
                          {v.thumbnail && (
                            <img
                              src={v.thumbnail}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                            <div className="h-12 w-12 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
                              <Play className="h-5 w-5 text-violet-700 ml-0.5" fill="currentColor" />
                            </div>
                          </div>
                          {done && (
                            <div className="absolute top-2 left-2 inline-flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
                              <CheckCircle2 className="h-3 w-3" /> Done
                            </div>
                          )}
                          {isActive && !done && (
                            <div className="absolute top-2 left-2 inline-flex items-center gap-1 bg-violet-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow animate-pulse">
                              Now playing
                            </div>
                          )}
                          <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                            <Clock className="h-3 w-3" /> {Math.max(1, Math.round(v.duration_sec / 60))}m
                          </div>
                        </button>
                        <div className="p-3 flex-1 flex flex-col">
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                            <span className="text-violet-600">Lesson {v._lesson}</span>
                            <span className={cn('text-slate-400', v.channel?.toLowerCase().includes('ibm') && 'text-blue-700', v.channel?.toLowerCase().includes('mit') && 'text-rose-700')}>
                              {v.channel}
                            </span>
                          </div>
                          <h4 className="font-semibold text-sm leading-snug line-clamp-2 mb-3 flex-1">
                            {v.title}
                          </h4>
                          <Button
                            onClick={() => setActiveVideo(v)}
                            disabled={isActive}
                            className={cn(
                              'w-full h-9 text-xs font-semibold gap-1.5',
                              done
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white'
                            )}
                            variant={done ? 'outline' : 'default'}
                          >
                            <Play className="h-3.5 w-3.5" fill="currentColor" />
                            {done ? 'Watch again' : isActive ? 'Now playing' : 'Watch lesson'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-violet-100 p-2 space-y-1">
                  {(mod.videos || []).map((v: any) => {
                    const done = progress[v.youtube_id]?.completed;
                    const isActive = activeVideo?.youtube_id === v.youtube_id;
                    return (
                      <button
                        key={v.youtube_id}
                        onClick={() => setActiveVideo(v)}
                        className={cn(
                          'w-full flex gap-3 p-2 rounded-xl text-left transition-all',
                          isActive ? 'bg-violet-50 ring-2 ring-violet-300' : 'hover:bg-slate-50'
                        )}
                      >
                        <div className="relative w-28 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-slate-200">
                          {v.thumbnail && <img src={v.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            {done ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Play className="h-4 w-4 text-white" fill="currentColor" />}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-violet-600 mb-0.5">Lesson {v._lesson}</div>
                          <div className="text-sm font-medium line-clamp-2 leading-snug">{v.title}</div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <span className={cn(v.channel?.toLowerCase().includes('ibm') && 'font-semibold text-blue-700', v.channel?.toLowerCase().includes('mit') && 'font-semibold text-rose-700')}>
                              {v.channel}
                            </span>
                            <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{Math.max(1, Math.round(v.duration_sec / 60))}m</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-violet-100 p-4 text-center">
        <div className="text-sm font-medium mb-2">How helpful was this path?</div>
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => rate(s)} className="p-1 hover:scale-110 transition-transform">
              <Star className="h-6 w-6 text-amber-400" fill="currentColor" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
