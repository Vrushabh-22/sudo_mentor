import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CandidateUser {
  id: string;
  email: string;
  candidateId: string;
  isVerified: boolean;
}

interface CandidateAuthContextType {
  user: CandidateUser | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any; needsConfirmation?: boolean; alreadyRegistered?: boolean }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
  pendingTenantChoices: null;
  selectTenant: (candidateId: string, tenantId: string) => Promise<void>;
  setActiveCandidate: (candidateId: string, tenantId: string) => Promise<void>;
}

const CandidateAuthContext = createContext<CandidateAuthContextType | undefined>(undefined);

async function resolveCandidate(authUserId: string, email: string): Promise<CandidateUser | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data } = await supabase
      .from("candidates")
      .select("id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (data?.id) {
      return { id: authUserId, email, candidateId: data.id as string, isVerified: true };
    }
    await supabase.from("candidates").insert({ user_id: authUserId, email }).select("id").maybeSingle();
  }
  return null;
}

export function CandidateAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CandidateUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      const resolved = await resolveCandidate(session.user.id, session.user.email || "");
      if (cancelled) return;
      setUser(resolved);
      setLoading(false);
    };

    hydrate();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setTimeout(hydrate, 0);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      return { error };
    }
    toast({ title: "Welcome back!" });
    return { error: null };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    if (error) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      return { error };
    }
    const needsConfirmation = !data.session;
    return { error: null, needsConfirmation };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      return { error };
    }
    return { error: null };
  };

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch {}
    setUser(null);
    window.location.href = "/auth";
  };

  const noopSelect = async () => {};

  return (
    <CandidateAuthContext.Provider
      value={{
        user,
        signIn,
        signUp,
        resetPassword,
        signOut,
        loading,
        pendingTenantChoices: null,
        selectTenant: noopSelect,
        setActiveCandidate: noopSelect,
      }}
    >
      {children}
    </CandidateAuthContext.Provider>
  );
}

export function useCandidateAuth() {
  const context = useContext(CandidateAuthContext);
  if (!context) throw new Error("useCandidateAuth must be used within a CandidateAuthProvider");
  return context;
}
