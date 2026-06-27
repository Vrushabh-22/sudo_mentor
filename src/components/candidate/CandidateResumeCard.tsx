import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Eye, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { invokeV4 } from "@/lib/candidatePortalV4Client";

interface Props {
  candidateId: string;
  tenantId?: string | null;
  resumeUrl?: string | null;
  candidateName?: string;
  variant: "v1" | "v4";
  onUpdated?: () => void;
}

/**
 * Simplified resume card for the standalone build. Uses an edge function
 * `upload-candidate-resume` if available, otherwise falls back to direct storage upload.
 */
export function CandidateResumeCard({ candidateId, resumeUrl, onUpdated }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const openResume = () => {
    if (!resumeUrl) return;
    window.open(resumeUrl, "_blank", "noopener,noreferrer");
  };

  const upload = async (file: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 20MB.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const path = `${candidateId}/resume-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("candidate-resumes").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("candidate-resumes").getPublicUrl(path);
      const { error } = await invokeV4({ action: "patch_profile", resume_url: pub.publicUrl });
      if (error) throw error;
      toast({ title: "Resume uploaded" });
      onUpdated?.();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message || "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 border-violet-100 bg-violet-50/40">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-violet-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Resume</div>
          <div className="text-xs text-muted-foreground truncate">
            {resumeUrl ? "Your resume is on file." : "Upload your resume (PDF / DOC, max 20MB)."}
          </div>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              {resumeUrl ? "Replace" : "Upload"}
            </Button>
            {resumeUrl && (
              <Button size="sm" variant="ghost" onClick={openResume}>
                <Eye className="h-3.5 w-3.5 mr-1" /> View
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) upload(f);
            }}
          />
        </div>
      </div>
    </Card>
  );
}
