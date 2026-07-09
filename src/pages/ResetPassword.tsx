import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady("ok");
    });
    // Fallback: if user already has a session (Supabase auto-signs in from hash), allow it.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady("ok");
      } else {
        // Give onAuthStateChange a moment; then mark invalid.
        setTimeout(() => setReady((r) => (r === "checking" ? "invalid" : r)), 1500);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.object({
      password: z.string().min(8, "Password must be at least 8 characters").max(72),
      confirm: z.string(),
    }).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] })
      .safeParse({ password, confirm });
    if (!parsed.success) {
      toast({ title: "Check your password", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Password updated", description: "You're signed in." });
    navigate("/portal", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8"><Logo className="h-8" /></div>

        {ready === "checking" && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying reset link...
          </div>
        )}

        {ready === "invalid" && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-sm text-destructive">
            This reset link is invalid or has expired.{" "}
            <Link to="/forgot-password" className="font-semibold underline">Request a new one</Link>.
          </div>
        )}

        {ready === "ok" && (
          <>
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">Set a new password</h2>
            <p className="mt-2 text-sm text-slate-500">Pick something you'll remember.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-600">New password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-xs font-semibold text-slate-600">Confirm password</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required minLength={8} />
              </div>
              <Button type="submit" className="w-full bg-slate-900 text-white hover:bg-slate-800" disabled={loading}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>) : ("Update password")}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
