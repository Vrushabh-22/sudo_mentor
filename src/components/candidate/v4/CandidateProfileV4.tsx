import { useState } from 'react';
import { V4Profile } from '@/pages/CandidatePortalV4';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getStorageUrl } from '@/utils/storageUrl';
import { invokeV4 } from '@/lib/candidatePortalV4Client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus, X, Sparkles, Pencil, Share2, MapPin, Mail, GraduationCap, Copy, Flame, Trophy, Linkedin } from 'lucide-react';
import { ProfileShareDialog } from './ProfileShareDialog';
import { CandidateResumeCard } from '@/components/candidate/CandidateResumeCard';

interface Props { candidate: V4Profile; onSaved: () => void }

const STREAMS = ['CSE', 'ECE', 'EEE', 'Mechanical', 'Civil', 'IT', 'MBA', 'BBA', 'B.Sc', 'M.Sc', 'B.Com', 'Other'];

export function CandidateProfileV4({ candidate, onSaved }: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [shareOpen, setShareOpen] = useState(false);
  const [c, setC] = useState<V4Profile>(candidate);
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState('');

  const setField = (k: keyof V4Profile | string, v: any) => setC({ ...c, [k]: v } as V4Profile);

  async function save() {
    setSaving(true);
    const payload: any = { action: 'patch_profile' };
    const fields: string[] = ['first_name', 'last_name', 'phone', 'headline', 'about', 'stream', 'institution', 'branch', 'graduation_year', 'cgpa', 'course', 'location', 'linkedin_url', 'skills_v4', 'projects', 'certifications', 'social_links', 'whatsapp_opt_in', 'whatsapp_phone'];
    for (const f of fields) payload[f] = (c as any)[f] ?? null;
    const { error } = await invokeV4(payload);
    setSaving(false);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Profile saved ✨' });
    onSaved();
    setMode('view');
  }

  function cancelEdit() {
    setC(candidate);
    setMode('view');
  }

  function addSkill() {
    const v = skillInput.trim();
    if (!v) return;
    const list = Array.isArray(c.skills_v4) ? c.skills_v4 : [];
    setField('skills_v4', [...list, { name: v }]);
    setSkillInput('');
  }
  function removeSkill(i: number) {
    const list = Array.isArray(c.skills_v4) ? [...c.skills_v4] : [];
    list.splice(i, 1);
    setField('skills_v4', list);
  }

  const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Your name';
  const initials = `${(c.first_name?.[0] || '').toUpperCase()}${(c.last_name?.[0] || '').toUpperCase()}` || 'U';

  const shareUrl = `${window.location.origin}/p/${(c as any).user_id || c.id}`;

  if (mode === 'edit') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between sticky top-0 z-10 bg-[#f8f7ff]/80 backdrop-blur-md py-2 -mt-2">
          <div>
            <h2 className="text-lg font-bold">Edit profile</h2>
            <p className="text-xs text-slate-500">Changes show on your shared profile instantly.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelEdit} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save
            </Button>
          </div>
        </div>

        <Card className="p-5 bg-gradient-to-br from-violet-50 to-fuchsia-50 border-violet-100">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 ring-4 ring-white shadow-lg">
              <AvatarImage src={getStorageUrl(c.photo_url)} className="object-cover" />
              <AvatarFallback className="text-xl bg-violet-200 text-violet-800">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate">{fullName}</h2>
              <p className="text-sm text-muted-foreground truncate">{c.headline || 'Add a headline to stand out'}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.email}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600" /> Basics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>First name</Label><Input value={c.first_name || ''} onChange={(e) => setField('first_name', e.target.value)} /></div>
            <div><Label>Last name</Label><Input value={c.last_name || ''} onChange={(e) => setField('last_name', e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={c.phone || ''} onChange={(e) => setField('phone', e.target.value)} /></div>
            <div><Label>Location</Label><Input value={c.location || ''} onChange={(e) => setField('location', e.target.value)} /></div>
          </div>
          <div><Label>Headline</Label><Input value={c.headline || ''} onChange={(e) => setField('headline', e.target.value)} placeholder="e.g. Final-year CSE @ IIT Bombay · ML enthusiast" /></div>
          <div><Label>About</Label><Textarea rows={3} value={c.about || ''} onChange={(e) => setField('about', e.target.value)} placeholder="A short intro about yourself" /></div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-600"
                checked={!!(c as any).whatsapp_opt_in}
                onChange={(e) => setField('whatsapp_opt_in', e.target.checked)}
              />
              <span className="text-sm font-medium">Receive WhatsApp updates</span>
            </label>
            <p className="text-xs text-slate-600">Get short status updates on WhatsApp when something happens with your application (interviews, offers, stage updates).</p>
            {(c as any).whatsapp_opt_in ? (
              <div>
                <Label className="text-xs">WhatsApp number (optional — uses your phone if blank)</Label>
                <Input
                  placeholder="+91 98XXXXXXXX"
                  value={(c as any).whatsapp_phone || ''}
                  onChange={(e) => setField('whatsapp_phone', e.target.value)}
                />
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">Education</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Stream</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={c.stream || ''} onChange={(e) => setField('stream', e.target.value)}>
                <option value="">Select…</option>
                {STREAMS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><Label>Institution</Label><Input value={c.institution || ''} onChange={(e) => setField('institution', e.target.value)} /></div>
            <div><Label>Course</Label><Input value={c.course || ''} onChange={(e) => setField('course', e.target.value)} placeholder="B.Tech, MBA…" /></div>
            <div><Label>Branch</Label><Input value={c.branch || ''} onChange={(e) => setField('branch', e.target.value)} /></div>
            <div><Label>Graduation Year</Label><Input type="number" value={c.graduation_year || ''} onChange={(e) => setField('graduation_year', Number(e.target.value) || undefined)} /></div>
            <div><Label>CGPA</Label><Input type="number" step="0.01" value={c.cgpa || ''} onChange={(e) => setField('cgpa', Number(e.target.value) || undefined)} /></div>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">Skills</h3>
          <div className="flex flex-wrap gap-2">
            {(c.skills_v4 || []).map((s: any, i: number) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">
                {s.name || s}
                <button onClick={() => removeSkill(i)}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} placeholder="Add a skill (Python, ML, …)" />
            <Button type="button" onClick={addSkill} variant="outline"><Plus className="h-4 w-4" /></Button>
          </div>
        </Card>

        <CandidateResumeCard
          variant="v4"
          candidateId={c.id}
          tenantId={(c as any).tenant_id}
          resumeUrl={(c as any).resume_url}
          candidateName={fullName}
          onUpdated={onSaved}
        />

        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">Links</h3>
          <div><Label>LinkedIn URL</Label><Input value={c.linkedin_url || ''} onChange={(e) => setField('linkedin_url', e.target.value)} /></div>
        </Card>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={cancelEdit} disabled={saving} className="flex-1 h-12">Cancel</Button>
          <Button onClick={save} disabled={saving} className="flex-1 h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-base font-semibold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save profile
          </Button>
        </div>
      </div>
    );
  }

  const skills = (c.skills_v4 || []) as any[];
  const xp = (c as any).xp_total ?? 0;
  const streak = (c as any).streak_days ?? 0;
  const completeness = (c as any).profile_completeness ?? Math.min(100, Math.max(0,
    [c.first_name, c.last_name, c.headline, c.about, c.location, c.institution, c.course, c.cgpa, skills.length].filter(Boolean).length * 11));
  const eduLine = [c.course, c.branch].filter(Boolean).join(' · ') || c.stream || 'Add education';

  async function copyShortLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied' });
    } catch {}
  }

  return (
    <div className="space-y-6">
      <CandidateResumeCard
        variant="v4"
        candidateId={c.id}
        tenantId={(c as any).tenant_id}
        resumeUrl={(c as any).resume_url}
        candidateName={fullName}
        onUpdated={onSaved}
      />
      <div className="relative bg-white rounded-[2rem] shadow-xl shadow-purple-100/50 overflow-hidden border border-white">
        <div className="h-40 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-500 relative">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        </div>
        <div className="px-6 sm:px-10 pb-8">
          <div className="relative flex flex-col md:flex-row md:items-end -mt-16 gap-6">
            <div className="relative shrink-0">
              <Avatar className="w-32 h-32 rounded-3xl border-8 border-white shadow-2xl overflow-hidden bg-slate-100">
                <AvatarImage src={getStorageUrl(c.photo_url)} className="object-cover" />
                <AvatarFallback className="rounded-3xl text-3xl bg-violet-200 text-violet-800">{initials}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 bg-green-500 border-4 border-white w-7 h-7 rounded-full shadow-lg" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 truncate">{fullName}</h1>
                  <p className="text-base font-medium text-violet-600 truncate">{c.headline || 'Add a headline to stand out'}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-medium text-slate-500">
                    {c.location && (
                      <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                        <MapPin className="w-3.5 h-3.5" /> {c.location}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100 truncate max-w-[220px]">
                        <Mail className="w-3.5 h-3.5" /> <span className="truncate">{c.email}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" onClick={() => setShareOpen(true)} className="rounded-xl font-bold gap-2">
                    <Share2 className="w-4 h-4" /> Share
                  </Button>
                  <Button onClick={() => setMode('edit')} className="rounded-xl font-bold gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 shadow-lg shadow-violet-200">
                    <Pencil className="w-4 h-4" /> Edit Details
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <button onClick={() => setMode('edit')} className="md:col-span-2 text-left bg-white p-7 rounded-[2rem] border border-white shadow-sm flex flex-col justify-center hover:shadow-md transition">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-violet-500 mb-2">The Story</h2>
          <h3 className="text-xl font-bold mb-3 text-slate-900">About Me</h3>
          {c.about ? (
            <p className="text-slate-600 leading-relaxed">{c.about}</p>
          ) : (
            <p className="text-slate-400 italic">Add a short intro about yourself — recruiters read this first.</p>
          )}
        </button>

        <div className="bg-slate-900 rounded-[2rem] p-7 text-white flex flex-col justify-between overflow-hidden relative min-h-[200px]">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-40 h-40 bg-violet-500/20 blur-3xl rounded-full" />
          <div>
            <div className="flex justify-between items-start mb-5">
              <div className="bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold border border-white/10 uppercase tracking-tighter flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Level {Math.max(1, Math.floor(xp / 100) + 1)}
              </div>
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-bold">{streak}d streak</span>
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-4xl font-black tabular-nums">{xp.toLocaleString()}</span>
              <p className="text-slate-400 font-medium text-sm">Experience Points</p>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 mb-2">
              <span>Profile Strength</span>
              <span>{completeness}%</span>
            </div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden p-0.5">
              <div className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400 rounded-full transition-all" style={{ width: `${completeness}%` }} />
            </div>
          </div>
        </div>

        <button onClick={() => setMode('edit')} className="text-left bg-white p-6 rounded-[2rem] border border-white shadow-sm space-y-4 hover:shadow-md transition">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-violet-500">Education</h2>
          <div className="flex gap-3">
            <div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100">
              <GraduationCap className="w-5 h-5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold truncate text-slate-900">{c.institution || 'Add institution'}</h4>
              <p className="text-sm text-slate-500 truncate">{eduLine}</p>
              {(c.cgpa || c.graduation_year) && (
                <p className="text-xs font-bold text-violet-600 mt-1.5">
                  {c.cgpa ? `CGPA ${c.cgpa}` : ''}{c.cgpa && c.graduation_year ? ' · ' : ''}{c.graduation_year ? `Class of ${c.graduation_year}` : ''}
                </p>
              )}
            </div>
          </div>
        </button>

        <button onClick={() => setMode('edit')} className="text-left bg-white p-6 rounded-[2rem] border border-white shadow-sm space-y-3 hover:shadow-md transition">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-violet-500">Core Skills</h2>
          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {skills.slice(0, 8).map((s: any, i: number) => {
                const tone = i === 0 ? 'bg-violet-50 text-violet-700 border-violet-100' :
                              i === 1 ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100' :
                              'bg-slate-50 text-slate-700 border-slate-100';
                return (
                  <span key={i} className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${tone}`}>
                    {s.name || s}
                  </span>
                );
              })}
              {skills.length > 8 && (
                <span className="px-3 py-1.5 rounded-xl text-xs font-bold border bg-slate-50 text-slate-500 border-slate-100">
                  +{skills.length - 8}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">Add your skills to attract better matches.</p>
          )}
        </button>

        <div className="bg-violet-600 p-6 rounded-[2rem] text-white flex flex-col justify-center relative overflow-hidden">
          <div className="absolute -bottom-6 -right-6 opacity-10">
            <Share2 className="w-24 h-24" />
          </div>
          <h2 className="text-[11px] font-black uppercase tracking-widest mb-3 opacity-70">Shareable Link</h2>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/20">
            <span className="text-xs font-bold truncate flex-1">{shareUrl.replace(/^https?:\/\//, '')}</span>
            <button onClick={copyShortLink} className="hover:scale-110 transition-transform p-1">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setShareOpen(true)} className="mt-3 text-[10px] font-bold opacity-80 hover:opacity-100 uppercase tracking-widest underline-offset-2 hover:underline text-left">
            Open share options →
          </button>
        </div>
      </div>

      {c.linkedin_url && (
        <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
           className="flex items-center gap-3 bg-white p-5 rounded-[2rem] border border-white shadow-sm hover:shadow-md transition">
          <div className="w-11 h-11 bg-[#0A66C2]/10 rounded-2xl flex items-center justify-center shrink-0">
            <Linkedin className="w-5 h-5 text-[#0A66C2]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-widest text-violet-500">LinkedIn</p>
            <p className="text-sm font-semibold text-slate-700 truncate">{c.linkedin_url}</p>
          </div>
        </a>
      )}

      <ProfileShareDialog open={shareOpen} onOpenChange={setShareOpen} url={shareUrl} name={fullName} />
    </div>
  );
}
