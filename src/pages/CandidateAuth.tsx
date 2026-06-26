import { useState, useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useCandidateAuth } from "@/hooks/useCandidateAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { callAutoLoginCandidate } from "@/utils/autoLoginCandidate";
import { useToast } from "@/hooks/use-toast";

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
  const { user, signIn, loading } = useCandidateAuth();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    email: searchParams.get("email") || "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  const [autoLoginError, setAutoLoginError] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
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
      window.location.href = "/";
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
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

  if (user) return <Navigate to="/" replace />;

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Briefcase className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Candidate Portal</CardTitle>
          <CardDescription>Access your job applications and track your progress</CardDescription>
        </CardHeader>
        <CardContent>
          {autoLoginError && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {autoLoginError}
            </div>
          )}

          <div className="space-y-3 mb-6">
            <Button variant="outline" className="w-full" onClick={() => handleSocialLogin("google")} disabled={!!socialLoading}>
              {socialLoading === "google" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
              <span className="ml-2">Continue with Google</span>
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleSocialLogin("github")} disabled={!!socialLoading}>
              {socialLoading === "github" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitHubIcon />}
              <span className="ml-2">Continue with GitHub</span>
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleSocialLogin("azure")} disabled={!!socialLoading}>
              {socialLoading === "azure" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkedInIcon />}
              <span className="ml-2">Continue with LinkedIn</span>
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="Enter your email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" value={formData.password} onChange={handleInputChange} placeholder="Enter your password" required />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || !formData.email || !formData.password}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
