import { EngineStatus } from "@/services/ai/types";
import { Progress } from "@/components/ui/progress";

interface ModelLoadingProps {
  status: EngineStatus;
}

export function ModelLoading({ status }: ModelLoadingProps) {
  if (status.source !== 'initializing') {
    return null; // Only show during initialization
  }

  const percent = Math.round(status.progress * 100);

  return (
    <div className="fixed top-0 inset-x-0 z-50 px-4 py-2 bg-white/95 backdrop-blur-md border-b text-xs flex items-center justify-between gap-4 shadow-sm">
      <div className="flex-1 truncate font-medium text-slate-700">
        Downloading Local AI Model... {percent}%
      </div>
      <div className="w-32 shrink-0">
        <Progress value={percent} className="h-1.5 bg-violet-100" />
      </div>
      <div className="truncate text-[10px] text-slate-500 max-w-[150px]">
        {status.progressText || 'Initializing Engine'}
      </div>
    </div>
  );
}
