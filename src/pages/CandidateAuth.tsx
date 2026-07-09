import { Logo } from "@/components/Logo";
import { useState, useEffect } from "react";
import { Navigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useCandidateAuth } from "@/hooks/useCandidateAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Brain, Code2, Trophy, Sparkles, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { callAutoLoginCandidate } from "@/utils/autoLoginCandidate";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { z } from "zod";

const VAPOR = { v1: "#c4b5fd", v2: "#818cf8", v3: "#67e8f9", v4: "#a5f3fc" };

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

export default function CandidateAuth() {
  const { user, signIn, signUp, loading } = useCandidateAuth();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    email: searchParams.get("email") || "",
    password: "",
  });
  const [signupData, setSignupData] = useState({ email: "", password: "", confirm: "" });
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  const [autoLoginError, setAutoLoginError] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const { toast } = useToast();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token && !user) {
      handleAutoLogin(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleAutoLogin = async (token: string) => {
    setIsAutoLoggingIn(true);
    setAutoLoginError(null);

    try {
      const data = await callAutoLoginCandidate(token);

      if (!data?.user) throw new Error("Invalid response from server");

      if (data.supabaseAuth) {
        let sessionEstablished = false;
        if (data.sessionTokens?.access_token && data.sessionTokens?.refresh_token) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: data.sessionTokens.access_token,
            refresh_token: data.sessionTokens.refresh_token,
          });
          if (!setErr) sessionEstablished = true;
        }
        if (!sessionEstablished && data.email && data.tempPassword) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.tempPassword,
          });
          if (signInError) {
            throw new Error(
              "Auto-login could not establish a session. Please log in manually with the temporary password emailed to you.",
            );
          }
        }
      }

      localStorage.setItem(
        "candidate_user",
        JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          tenantId: data.user.tenantId,
          candidateId: data.user.candidateId || data.user.id,
        }),
      );

      toast({ title: "Welcome!", description: "Successfully logged in. Redirecting to your portal..." });
      window.location.href = "/portal";
    } catch (error: any) {
      const message = error?.message || "Unable to auto-login. Please use the manual login form below.";
      setAutoLoginError(message);
      toast({ title: "Auto-login Failed", description: message, variant: "destructive" });
    } finally {
      setIsAutoLoggingIn(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "github" | "azure") => {
    setSocialLoading(provider);
    try {
      const intendedRedirect = searchParams.get("redirect") || "/portal";
      try {
        sessionStorage.setItem("candidate_post_login_redirect", intendedRedirect);
      } catch {}
      const redirectTo = `${window.location.origin}/auth?redirect=${encodeURIComponent(intendedRedirect)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          ...(provider === "azure" ? { scopes: "openid profile email" } : {}),
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Unable to sign in. Please try again.",
        variant: "destructive",
      });
      setSocialLoading(null);
    }
  };

  if (user) return <Navigate to="/portal" replace />;

  if (isAutoLoggingIn || (loading && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">{isAutoLoggingIn ? "Logging you in..." : "Loading..."}</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) return;
    setIsSubmitting(true);
    await signIn(formData.email, formData.password);
    setIsSubmitting(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const signupSchema = z.object({
    email: z.string().trim().email("Please enter a valid email").max(255),
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirm: z.string(),
  }).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

  const RATE_KEY = "sudomentor.signup.attempts";
  const RATE_MAX = 3;
  const RATE_WINDOW_MS = 10 * 60 * 1000;

  const readAttempts = (): number[] => {
    try {
      const raw = localStorage.getItem(RATE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const arr: number[] = Array.isArray(parsed?.timestamps) ? parsed.timestamps : [];
      const cutoff = Date.now() - RATE_WINDOW_MS;
      return arr.filter((t) => typeof t === "number" && t > cutoff);
    } catch {
      return [];
    }
  };

  const recordAttempt = () => {
    const next = [...readAttempts(), Date.now()];
    try { localStorage.setItem(RATE_KEY, JSON.stringify({ timestamps: next })); } catch {}
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(signupData);
    if (!parsed.success) {
      toast({ title: "Check your details", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    const attempts = readAttempts();
    if (attempts.length >= RATE_MAX) {
      const waitMs = attempts[0] + RATE_WINDOW_MS - Date.now();
      const mins = Math.max(1, Math.ceil(waitMs / 60000));
      toast({
        title: "Too many sign-up attempts",
        description: `Please try again in ~${mins} minute${mins === 1 ? "" : "s"}.`,
        variant: "destructive",
      });
      return;
    }
    setIsSigningUp(true);
    recordAttempt();
    const { error, needsConfirmation, alreadyRegistered } = await signUp(parsed.data.email, parsed.data.password);
    setIsSigningUp(false);
    if (error) return;
    if (alreadyRegistered) {
      toast({
        title: "Email already registered",
        description: "Sign in below or reset your password if you forgot it.",
      });
      setFormData((prev) => ({ ...prev, email: parsed.data.email }));
      setSignupData({ email: "", password: "", confirm: "" });
      setActiveTab("signin");
      setTimeout(() => document.getElementById("password")?.focus(), 50);
      return;
    }
    if (needsConfirmation) {
      // Confirm-email is still enabled in Supabase. Nudge the user to check inbox.
      toast({
        title: "Check your email",
        description: "We sent a confirmation link. Once confirmed, sign in below.",
      });
      setActiveTab("signin");
      setFormData((prev) => ({ ...prev, email: parsed.data.email }));
      setSignupData({ email: "", password: "", confirm: "" });
    }
    // On success signIn is already established by the hook — auth state routes to /portal.
  };

  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSignupData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 lg:grid lg:grid-cols-[1.1fr,0.9fr]">
      {/* BRAND PANEL */}
      <aside
        className="relative overflow-hidden px-6 py-10 text-white lg:px-14 lg:py-12"
        style={{ background: `linear-gradient(135deg, ${VAPOR.v2} 0%, ${VAPOR.v3} 100%)` }}
      >
        {/* blobs */}
        <motion.div
          aria-hidden
          animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-32 -top-20 h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
          style={{ background: VAPOR.v1 }}
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -bottom-32 -right-20 h-[480px] w-[480px] rounded-full opacity-40 blur-3xl"
          style={{ background: VAPOR.v4 }}
        />
        {/* dot pattern overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-15 mix-blend-overlay"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative flex h-full flex-col">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white">
            <Logo className="h-8" to={null} onDark />
          </Link>

          <div className="mt-10 hidden lg:mt-16 lg:block">
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="font-display text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl"
            >
              Welcome to your<br />career copilot.
            </motion.h1>
            <p className="mt-4 max-w-md text-white/85">
              Mentor. Projects. Practice. Jobs — all in one place. Built for college.
            </p>

            <ul className="mt-10 space-y-4 max-w-md">
              {[
                { icon: Brain, label: "AI mentor that remembers you" },
                { icon: Code2, label: "Internship-grade projects, AI-evaluated" },
                { icon: Trophy, label: "Climb your campus leaderboard" },
              ].map((f, i) => (
                <motion.li
                  key={f.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
                  className="flex items-center gap-3 text-sm font-medium"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 backdrop-blur ring-1 ring-white/30">
                    <f.icon className="h-4 w-4" />
                  </div>
                  {f.label}
                </motion.li>
              ))}
            </ul>

            <div className="mt-12 rounded-2xl border border-white/25 bg-white/10 p-5 backdrop-blur max-w-md">
              <div className="flex items-center gap-1 text-amber-200">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Sparkles key={i} className="h-3.5 w-3.5" />
                ))}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/95">
                "Got my first internship in 6 weeks. The mentor felt like a senior who actually cared."
              </p>
              <p className="mt-2 text-xs font-semibold text-white/75">— Aman, IIT Delhi</p>
            </div>
          </div>

          {/* mobile compact tagline */}
          <div className="mt-4 lg:hidden">
            <h1 className="font-display text-2xl font-bold">Welcome back.</h1>
            <p className="text-sm text-white/85">Sign in to your career copilot.</p>
          </div>
        </div>
      </aside>

      {/* FORM PANEL */}
      <main className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 hidden items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 lg:inline-flex"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>

          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-500">Sign in to continue your journey.</p>

          {autoLoginError && (
            <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {autoLoginError}
            </div>
          )}

          <div className="mt-7 space-y-2.5">
            <Button variant="outline" className="w-full justify-center" onClick={() => handleSocialLogin("google")} disabled={!!socialLoading}>
              {socialLoading === "google" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
              <span className="ml-2">Continue with Google</span>
            </Button>
            <Button variant="outline" className="w-full justify-center" onClick={() => handleSocialLogin("github")} disabled={!!socialLoading}>
              {socialLoading === "github" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitHubIcon />}
              <span className="ml-2">Continue with GitHub</span>
            </Button>
            <Button variant="outline" className="w-full justify-center" onClick={() => handleSocialLogin("azure")} disabled={!!socialLoading}>
              {socialLoading === "azure" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkedInIcon />}
              <span className="ml-2">Continue with LinkedIn</span>
            </Button>
          </div>

          <p className="mt-3 text-center text-xs text-slate-400">
            New here? Pick any social login — we'll set up your account.
          </p>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-[11px] font-semibold uppercase tracking-wider">
              <span className="bg-white px-3 text-slate-400">or with email</span>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "signin" | "signup")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-600">Email</Label>
                  <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="you@college.edu" required />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-semibold text-slate-600">Password</Label>
                    <Link to="/forgot-password" className="text-xs font-medium text-slate-500 hover:text-slate-900">Forgot?</Link>
                  </div>
                  <Input id="password" name="password" type="password" value={formData.password} onChange={handleInputChange} placeholder="••••••••" required />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-slate-900 text-white hover:bg-slate-800"
                  disabled={isSubmitting || !formData.email || !formData.password}
                >
                  {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : ("Sign in")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-5">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email" className="text-xs font-semibold text-slate-600">Email</Label>
                  <Input id="signup-email" name="email" type="email" value={signupData.email} onChange={handleSignupChange} placeholder="you@college.edu" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password" className="text-xs font-semibold text-slate-600">Password</Label>
                  <Input id="signup-password" name="password" type="password" value={signupData.password} onChange={handleSignupChange} placeholder="At least 8 characters" required minLength={8} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-confirm" className="text-xs font-semibold text-slate-600">Confirm password</Label>
                  <Input id="signup-confirm" name="confirm" type="password" value={signupData.confirm} onChange={handleSignupChange} placeholder="••••••••" required minLength={8} />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-slate-900 text-white hover:bg-slate-800"
                  disabled={isSigningUp}
                >
                  {isSigningUp ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</>) : ("Create account")}
                </Button>
              </form>
            </TabsContent>

          </Tabs>

          <p className="mt-8 text-center text-xs text-slate-400">
            By continuing, you agree to our{" "}
            <a href="#" className="font-medium text-slate-600 hover:text-slate-900">Terms</a> and{" "}
            <a href="#" className="font-medium text-slate-600 hover:text-slate-900">Privacy Policy</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
