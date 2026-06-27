import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCandidateAuth } from "@/hooks/useCandidateAuth";
import { getCandidateToken } from "@/utils/candidateAuthHelper";
import { Card } from "@/components/ui/card";
import { Briefcase, Building2, ChevronRight, Loader2 } from "lucide-react";

interface Application {
  id: string;
  job: { id: string; title: string; company: string; location: string; department: string; tenant_id: string };
  status: string;
  submitted_at: string;
  ai_matching_score: number;
  tenant: { name: string };
  workflow: { current_stage: number; stages: any[]; total_stages: number };
  stage_scores: Record<number, any>;
  stage_data?: any;
  schedule?: any;
  interviews?: any[];
  shortlisting_reasoning?: string | null;
}

interface Props {
  candidateId: string;
  DetailComponent?: React.ComponentType<{
    application: Application;
    candidateId: string;
    hasResume: boolean;
    onBack: () => void;
    onUploadResume: () => void;
  }>;
}

export function V2ApplicationsList({ candidateId, DetailComponent }: Props) {
  const { user } = useCandidateAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);

  useEffect(() => {
    if (!candidateId) return;
    (async () => {
      try {
        const token = await getCandidateToken();
        const { data, error } = await supabase.functions.invoke("get-candidate-applications", {
          body: { candidateId, token, email: user?.email },
        });
        if (error) throw error;
        setApps(data?.applications || []);
      } catch (e) {
        console.error("apps fetch failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [candidateId, user?.email]);

  if (loading) {
    return (
      <div className="space-y-3 mt-4">
        <div className="h-20 bg-violet-100/30 rounded-2xl animate-pulse" />
        <div className="h-20 bg-violet-100/30 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="text-center py-16 mt-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-100 mb-5">
          <Briefcase className="h-8 w-8 text-violet-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Welcome to Your Portal</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          When you're being considered for a role, all the details will appear right here.
        </p>
      </div>
    );
  }

  if (selected && DetailComponent) {
    return (
      <DetailComponent
        application={selected}
        candidateId={candidateId}
        hasResume={true}
        onBack={() => setSelected(null)}
        onUploadResume={() => {}}
      />
    );
  }

  return (
    <div className="space-y-3">
      {apps.map((a) => (
        <button
          key={a.id}
          onClick={() => setSelected(a)}
          className="w-full text-left"
        >
          <Card className="p-4 hover:shadow-md hover:border-violet-300 transition flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <Briefcase className="h-5 w-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{a.job?.title}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{a.tenant?.name || "alphaRecrewt"}</span>
                <span>·</span>
                <span>
                  Stage {(a.workflow?.current_stage ?? 0) + 1}/{a.workflow?.total_stages || 1}
                </span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Card>
        </button>
      ))}
    </div>
  );
}
