import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invokeV4 } from '@/lib/candidatePortalV4Client';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { InstituteAutocomplete } from './InstituteAutocomplete';

const STREAMS = ['CSE', 'IT', 'ECE', 'EEE', 'Mech', 'Civil', 'MBA', 'BBA', 'B.Sc', 'M.Sc', 'BCA', 'MCA', 'Other'];

interface Props {
  fields: string[];
  initial: Record<string, any>;
  onSubmitted: (patch: Record<string, any>) => void;
}

export function ProfileFormCard({ fields, initial: _initial, onSubmitted }: Props) {
  const [vals, setVals] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: string, v: any) => setVals((s) => ({ ...s, [k]: v }));

  async function submit() {
    setLoading(true);
    const patch: any = { ...vals };
    if (vals.skills && typeof vals.skills === 'string') {
      patch.skills_v4 = vals.skills.split(',').map((s: string) => s.trim()).filter(Boolean).map((name: string) => ({ name }));
      delete patch.skills;
    }
    if (vals.graduation_year) patch.graduation_year = parseInt(vals.graduation_year, 10);
    if (vals.cgpa) patch.cgpa = parseFloat(vals.cgpa);
    const { error } = await invokeV4({ action: 'patch_profile', ...patch });
    setLoading(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    setDone(true);
    onSubmitted(patch);
  }

  if (done) {
    return (
      <div className="mt-2 flex items-center gap-2 text-emerald-700 text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
        <CheckCircle2 className="h-4 w-4" /> Saved! Profile updated.
      </div>
    );
  }

  return (
    <div className="mt-2 bg-white border border-violet-200 rounded-xl p-3 space-y-3">
      <div className="text-xs font-semibold text-violet-700">Quick profile setup</div>
      {fields.includes('stream') && (
        <div>
          <Label className="text-xs">Stream</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {STREAMS.map((s) => (
              <button key={s} type="button" onClick={() => set('stream', s)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${vals.stream === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-slate-200 hover:border-violet-300'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {fields.includes('branch') && (
        <div>
          <Label className="text-xs">Branch / Specialization</Label>
          <Input className="h-9 text-sm" placeholder="e.g. Computer Science" value={vals.branch || ''} onChange={(e) => set('branch', e.target.value)} />
        </div>
      )}
      {fields.includes('institution') && (
        <div>
          <Label className="text-xs">Institution</Label>
          <Input className="h-9 text-sm" placeholder="College name" value={vals.institution || ''} onChange={(e) => set('institution', e.target.value)} />
        </div>
      )}
      {fields.includes('graduation_year') && (
        <div>
          <Label className="text-xs">Graduation Year</Label>
          <Input type="number" min="2024" max="2032" className="h-9 text-sm" placeholder="2026" value={vals.graduation_year || ''} onChange={(e) => set('graduation_year', e.target.value)} />
        </div>
      )}
      {fields.includes('cgpa') && (
        <div>
          <Label className="text-xs">CGPA / %</Label>
          <Input type="number" step="0.01" min="0" max="10" className="h-9 text-sm" placeholder="8.2" value={vals.cgpa || ''} onChange={(e) => set('cgpa', e.target.value)} />
        </div>
      )}
      {fields.includes('skills') && (
        <div>
          <Label className="text-xs">Top skills (comma separated)</Label>
          <Input className="h-9 text-sm" placeholder="React, Python, SQL" value={vals.skills || ''} onChange={(e) => set('skills', e.target.value)} />
        </div>
      )}
      <Button onClick={submit} disabled={loading} size="sm" className="w-full bg-violet-600 hover:bg-violet-700">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Save & continue
      </Button>
    </div>
  );
}
