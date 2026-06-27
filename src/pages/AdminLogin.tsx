import { Logo } from "@/components/Logo";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const { loading, isAdmin } = useIsAdmin();
  const [email, setEmail] = useState("akshay.deshmukh@techademy.com");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const { toast } = useToast();

  // Idempotent super-admin bootstrap (first load only).
  useEffect(() => {
    (async () => {
      try {
        await supabase.functions.invoke("bootstrap-super-admin", { body: {} });
      } catch {/* ignore — idempotent */}
      setBootstrapping(false);
    })();
  }, []);

  if (!loading && isAdmin) return <Navigate to="/admin" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      return;
    }
    // Verify admin role.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      await supabase.auth.signOut();
      toast({
        title: "Not an admin",
        description: "This account does not have admin access.",
        variant: "destructive",
      });
      return;
    }
    window.location.href = "/admin";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo className="h-[3.1rem]" to={null} />
          </div>
          <CardTitle className="text-2xl">Admin sign in</CardTitle>
          <CardDescription>Sudomentor control panel</CardDescription>
        </CardHeader>
        <CardContent>
          {bootstrapping && (
            <div className="mb-4 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Preparing admin account…
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={submitting || !email || !password}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</> : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
