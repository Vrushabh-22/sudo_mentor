import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeV4 } from '@/lib/candidatePortalV4Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { Loader2, MapPin, Briefcase, Search, Building2, Clock, CheckCircle2, Sparkles } from 'lucide-react';
import { getStorageUrl } from '@/utils/storageUrl';

interface JobItem {
  id: string;
  title: string;
  location?: string;
  employment_type?: string;
  experience_level?: string;
  department?: string;
  skills_required?: string[] | null;
  description?: string;
  created_at: string;
}
interface TenantGroup {
  tenant: { id: string; name: string; logo_url?: string | null };
  jobs: JobItem[];
}

interface Props {
  candidateEmail: string;
  onApplied?: () => void;
}

export function DiscoverJobs({ candidateEmail, onApplied }: Props) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<TenantGroup[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ job: JobItem; tenant: TenantGroup['tenant'] } | null>(null);
  const [applying, setApplying] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeV4<{ groups: TenantGroup[] }>({ action: 'list_open_jobs' });
      if (error) throw error;
      setGroups(data?.groups || []);
    } catch (e: any) {
      console.error('discover jobs failed', e);
      toast({ title: 'Could not load jobs', description: e?.message || 'Please try again', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        jobs: g.jobs.filter((j) =>
          [j.title, j.location, j.department, ...(j.skills_required || [])]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)
        ),
      }))
      .filter((g) => g.jobs.length > 0);
  }, [groups, search]);

  const totalJobs = filtered.reduce((n, g) => n + g.jobs.length, 0);

  const handleApply = async () => {
    if (!selected) return;
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke('apply-with-social', {
        body: { jobId: selected.job.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAppliedIds((s) => new Set(s).add(selected.job.id));
      toast({ title: 'Application submitted ✨', description: `Applied to ${selected.job.title}` });
      setSelected(null);
      onApplied?.();
    } catch (e: any) {
      toast({ title: 'Apply failed', description: e?.message || 'Please try again', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-violet-100/40 rounded-xl animate-pulse" />
        <div className="h-32 bg-violet-100/30 rounded-2xl animate-pulse" />
        <div className="h-32 bg-violet-100/30 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, skill, location…"
            className="pl-9 h-10 bg-white"
          />
        </div>
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {totalJobs} open
        </Badge>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-100 mb-4">
            <Briefcase className="h-8 w-8 text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No open jobs found</h3>
          <p className="text-sm text-muted-foreground">Try a different search or check back soon.</p>
        </div>
      )}

      <div className="space-y-6">
        {filtered.map((g) => (
          <section key={g.tenant.id}>
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {g.tenant.logo_url ? (
                  <img src={getStorageUrl(g.tenant.logo_url) || ''} alt={g.tenant.name} className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-4 w-4 text-violet-600" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{g.tenant.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {g.jobs.length} open role{g.jobs.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {g.jobs.map((j) => {
                const applied = appliedIds.has(j.id);
                return (
                  <div
                    key={j.id}
                    className="bg-white rounded-2xl border border-violet-100 p-4 hover:shadow-md hover:border-violet-300 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-violet-700 transition-colors">
                        {j.title}
                      </h3>
                      {applied && (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] flex-shrink-0">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Applied
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mb-3">
                      {j.location && (
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {j.location}</span>
                      )}
                      {j.employment_type && (
                        <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {j.employment_type}</span>
                      )}
                      {j.experience_level && (
                        <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> {j.experience_level}</span>
                      )}
                    </div>
                    {Array.isArray(j.skills_required) && j.skills_required.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {j.skills_required.slice(0, 4).map((s, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
                            {s}
                          </span>
                        ))}
                        {j.skills_required.length > 4 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            +{j.skills_required.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> {new Date(j.created_at).toLocaleDateString()}
                      </span>
                      <Button
                        size="sm"
                        variant={applied ? 'outline' : 'default'}
                        disabled={applied}
                        onClick={() => setSelected({ job: j, tenant: g.tenant })}
                        className={applied ? '' : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700'}
                      >
                        {applied ? 'Applied' : 'View & Apply'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-xs font-semibold text-violet-700">{selected.tenant.name}</span>
                </div>
                <SheetTitle className="text-xl">{selected.job.title}</SheetTitle>
                <SheetDescription>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mt-1">
                    {selected.job.location && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selected.job.location}</span>
                    )}
                    {selected.job.employment_type && (
                      <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {selected.job.employment_type}</span>
                    )}
                  </div>
                </SheetDescription>
              </SheetHeader>

              <div className="py-4 space-y-4">
                {Array.isArray(selected.job.skills_required) && selected.job.skills_required.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Skills</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.job.skills_required.map((s, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selected.job.description && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">About the role</div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {selected.job.description}
                    </div>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground bg-violet-50/60 rounded-xl p-3 border border-violet-100">
                  Applying as <span className="font-semibold text-violet-700">{candidateEmail}</span>. Your profile and resume will be shared with {selected.tenant.name}.
                </div>
              </div>

              <div className="sticky bottom-0 bg-white pt-3 border-t">
                <Button
                  onClick={handleApply}
                  disabled={applying || appliedIds.has(selected.job.id)}
                  className="w-full h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 font-semibold"
                >
                  {applying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {appliedIds.has(selected.job.id) ? 'Applied' : 'Apply now'}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
