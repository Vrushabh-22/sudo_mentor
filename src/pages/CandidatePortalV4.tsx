import { useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useCandidateAuth } from "@/hooks/useCandidateAuth";
import { invokeV4 } from "@/lib/candidatePortalV4Client";
import { Loader2, X } from "lucide-react";
import { V4Shell } from "@/components/candidate/v4/V4Shell";
import { TenantPickerModal } from "@/components/candidate/TenantPickerModal";
import { useCandidatePWAManifest } from "@/hooks/useCandidatePWAManifest";
import { MyBoardCanvas } from "@/components/candidate/v4/myboard/MyBoardCanvas";

export interface V4Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  photo_url?: string;
  headline?: string;
  about?: string;
  stream?: string;
  institution?: string;
  course?: string;
  branch?: string;
  graduation_year?: number;
  cgpa?: number;
  location?: string;
  linkedin_url?: string;
  resume_url?: string;
  skills_v4?: any[];
  projects?: any[];
  certifications?: any[];
  social_links?: Record<string, string>;
  profile_completeness?: number;
  xp_total?: number;
  streak_days?: number;
  tenant_id?: string;
}

export interface V4Bootstrap {
  candidate: V4Profile;
  credits: { balance: number; lifetime_earned: number };
  today_attempts: number;
  daily_limit: number;
}

export default function CandidatePortalV4() {
  useCandidatePWAManifest();
  const { user, loading, pendingTenantChoices, selectTenant } = useCandidateAuth();
  const [data, setData] = useState<V4Bootstrap | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const isFullscreen = new URLSearchParams(window.location.search).get("fullscreenBoard") === "1";

  const refresh = useCallback(async () => {
    const { data: res, error } = await invokeV4({ action: "get_profile" });
    if (error) {
      setLoadErr(error.message);
      return;
    }
    setData(res as V4Bootstrap);
  }, []);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  if (pendingTenantChoices && pendingTenantChoices.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <TenantPickerModal choices={pendingTenantChoices} onSelect={selectTenant} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?role=candidate&redirect=/" replace />;

  if (loadErr) {
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive p-6 text-center">
        Could not load your profile: {loadErr}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isFullscreen) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#F4F1FB] relative">
        <button
          onClick={() => window.close()}
          className="absolute top-3 right-3 z-50 flex items-center gap-1.5 bg-white/95 backdrop-blur rounded-xl border border-violet-100 shadow-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-violet-50 transition"
          title="Close fullscreen board"
        >
          <X className="h-4 w-4" /> Close
        </button>
        <MyBoardCanvas
          bootstrap={data}
          onRefresh={refresh}
          candidateId={user?.candidateId || ""}
          candidateEmail={data.candidate.email}
          fullscreen
        />
      </div>
    );
  }

  return <V4Shell bootstrap={data} onRefresh={refresh} />;
}
