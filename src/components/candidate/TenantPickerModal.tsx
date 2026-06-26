import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Building2, ChevronRight, Loader2 } from "lucide-react";

export interface TenantChoice {
  candidateId: string;
  tenantId: string;
  tenantName: string;
  logoUrl: string | null;
  applicationCount: number;
}

interface TenantPickerModalProps {
  choices: TenantChoice[];
  onSelect: (candidateId: string, tenantId: string) => Promise<void>;
}

export function TenantPickerModal({ choices, onSelect }: TenantPickerModalProps) {
  const [pickingId, setPickingId] = useState<string | null>(null);

  const handlePick = async (choice: TenantChoice) => {
    if (pickingId) return;
    setPickingId(choice.candidateId);
    try {
      await onSelect(choice.candidateId, choice.tenantId);
    } catch {
      setPickingId(null);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md bg-white/95 backdrop-blur-xl border-border/40 shadow-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Choose your recruiter</DialogTitle>
          <DialogDescription>
            Your email is registered with multiple organizations. Pick one to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto -mx-1 px-1">
          {choices.map((choice) => {
            const isPicking = pickingId === choice.candidateId;
            return (
              <button
                key={`${choice.candidateId}-${choice.tenantId}`}
                onClick={() => handlePick(choice)}
                disabled={!!pickingId}
                className="w-full group flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-white/80 hover:bg-primary/5 hover:border-primary/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-left"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                  {choice.logoUrl ? (
                    <img
                      src={choice.logoUrl}
                      alt={choice.tenantName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Building2 className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground truncate">{choice.tenantName}</div>
                  <div className="text-xs text-muted-foreground">
                    {choice.applicationCount === 0
                      ? "No applications yet"
                      : `${choice.applicationCount} application${choice.applicationCount === 1 ? "" : "s"}`}
                  </div>
                </div>
                {isPicking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          You can switch later by signing out and signing in again.
        </p>
      </DialogContent>
    </Dialog>
  );
}
