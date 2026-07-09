import { useState } from "react";
import { Link } from "react-router-dom";
import { useCandidateAuth } from "@/hooks/useCandidateAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const { resetPassword } = useCandidateAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().trim().email().max(255).safeParse(email);
    if (!parsed.success) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(parsed.data);
    setLoading(false);
    if (!error) setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between">
          <Logo className="h-8" />
          <Link to="/auth" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>

        <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">Reset your password</h2>
        <p className="mt-2 text-sm text-slate-500">
          Enter your email and we'll send you a link to set a new password.
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <MailCheck className="mx-auto h-8 w-8 text-emerald-600" />
            <h3 className="mt-3 font-semibold text-slate-900">Check your inbox</h3>
            <p className="mt-1 text-sm text-slate-600">
              If an account exists for <strong>{email}</strong>, a reset link is on its way.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-600">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" required />
            </div>
            <Button type="submit" className="w-full bg-slate-900 text-white hover:bg-slate-800" disabled={loading || !email}>
              {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>) : ("Send reset link")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
