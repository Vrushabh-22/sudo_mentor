import { ArrowLeft, Briefcase, Building2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  application: any;
  candidateId: string;
  hasResume: boolean;
  onBack: () => void;
  onUploadResume: () => void;
}

function humanizeStageType(type: string): string {
  const map: Record<string, string> = {
    shortlisting: "Shortlisting",
    resume_screening: "Resume Screening",
    assessment: "Assessment",
    smart_assessment: "Smart Assessment",
    ai_interview: "AI Interview",
    interview: "Interview",
    human_interview: "Interview",
    offer: "Offer",
    checkpoint: "Checkpoint",
    pre_screening: "Pre-Screening",
  };
  return map[type] || type.replace(/_/g, " ");
}

function formatDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/**
 * Read-only timeline view for the standalone build. The full ATS instance
 * mounts V2WorkflowStages here with interactive assessment/interview surfaces;
 * those flows live on the main alphaRecrewt portal.
 */
export function V4ApplicationTimeline({ application, onBack }: Props) {
  const workflow = application.workflow;
  const currentStage = workflow?.current_stage ?? 0;
  const stages = workflow?.stages || [];
  const totalStages = workflow?.total_stages ?? stages.length;

  const getStatus = (i: number): "completed" | "current" | "pending" => {
    if (i < currentStage) return "completed";
    if (i === currentStage) return "current";
    return "pending";
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-lg">
        <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-10 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/15 transition-colors" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold truncate">{application.job?.title}</h1>
            <p className="text-xs sm:text-sm text-white/80 truncate">{application.tenant?.name || "alphaRecrewt"}</p>
          </div>
          <span className="text-xs font-semibold bg-white/20 backdrop-blur px-2.5 py-1 rounded-full">
            {currentStage}/{totalStages}
          </span>
        </div>

        <div className="px-5 sm:px-7 pb-5 -mt-5">
          <div className="bg-white rounded-2xl shadow-md p-3.5 sm:p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <Briefcase className="h-5 w-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 text-sm sm:text-base truncate">{application.job?.title}</div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Building2 className="h-3 w-3" />
                <span className="truncate">Applied {formatDate(application.submitted_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-violet-100 shadow-sm p-4 sm:p-6">
        <h2 className="text-xs font-bold text-slate-400 tracking-[0.15em] uppercase mb-5">Application Timeline</h2>
        <div className="relative">
          {stages.map((stage: any, i: number) => {
            const status = getStatus(i);
            const isLast = i === stages.length - 1;
            const nodeColor =
              status === "completed"
                ? "bg-emerald-500 border-emerald-500"
                : status === "current"
                ? "bg-violet-600 border-violet-600 ring-4 ring-violet-100"
                : "bg-white border-slate-300";
            const railColor = status === "completed" ? "bg-emerald-400" : "bg-slate-200";
            const pillBg =
              status === "completed"
                ? "bg-emerald-100 text-emerald-700"
                : status === "current"
                ? "bg-violet-100 text-violet-700"
                : "bg-slate-100 text-slate-500";
            const pillLabel = status === "completed" ? "Completed" : status === "current" ? "In Progress" : "Pending";

            return (
              <div key={i} className="relative flex gap-4 pb-7 last:pb-0">
                <div className="flex flex-col items-center shrink-0">
                  <div className={cn("h-7 w-7 rounded-full border-2 flex items-center justify-center z-10 transition-all", nodeColor)}>
                    {status === "completed" && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                    {status === "current" && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  {!isLast && <div className={cn("w-0.5 flex-1 mt-1 min-h-[3rem]", railColor)} />}
                </div>
                <div
                  className={cn(
                    "flex-1 min-w-0 rounded-xl transition-all",
                    status === "current" && "bg-violet-50/70 border border-violet-200 p-3 -mt-1",
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 text-sm sm:text-base truncate">{stage.name}</div>
                      <div className="text-xs text-slate-500">{humanizeStageType(stage.stage_type)}</div>
                    </div>
                    <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap", pillBg)}>
                      {pillLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {application.workflow?.current_stage < (application.workflow?.total_stages ?? 0) && (
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-violet-100 shadow-sm p-5">
          <div className="text-sm text-slate-600">
            For interactive assessments and interviews, please continue this application on the main alphaRecrewt portal.
          </div>
        </div>
      )}
    </div>
  );
}
