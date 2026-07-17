import { EngineStatus } from "@/services/ai/types";
import { Cloud, Cpu, Loader2 } from "lucide-react";

interface AIStatusBadgeProps {
  status: EngineStatus;
}

export function AIStatusBadge({ status }: AIStatusBadgeProps) {
  if (status.source === 'none' || status.source === 'initializing') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" /> 
        {status.source === 'initializing' ? 'Initializing AI...' : 'Offline'}
      </div>
    );
  }

  if (status.source === 'local') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-700" title="Running on your device">
        <Cpu className="h-3 w-3" /> Local AI
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-[10px] font-medium text-sky-700" title="Running in the cloud">
      <Cloud className="h-3 w-3" /> Cloud AI
    </div>
  );
}
