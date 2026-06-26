import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { TenantChoice } from "@/components/candidate/TenantPickerModal";

interface CandidateUser {
  id: string;
  email: string;
  candidateId: string;
  isVerified: boolean;
  tenantId: string;
}

interface CandidateAuthContextType {
  user: CandidateUser | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
  pendingTenantChoices: TenantChoice[] | null;
  selectTenant: (candidateId: string, tenantId: string) => Promise<void>;
  setActiveCandidate: (candidateId: string, tenantId: string) => Promise<void>;
}

const CandidateAuthContext = createContext<CandidateAuthContextType | undefined>(undefined);

const SESSION_CANDIDATE_KEY = "candidate_session_user";

type EdgeResolveResult =
  | { kind: "user"; user: CandidateUser }
  | { kind: "picker"; choices: TenantChoice[] }
  | { kind: "none" };

async function resolveCandidateViaEdge(): Promise<EdgeResolveResult> {
  try {
    const { data, error } = await supabase.functions.invoke("resolve-candidate-by-email", {
      body: { preferCandidate: true, portal: "candidate" },
    });
    if (error) return { kind: "none" };
    if (data?.needsTenantSelection && Array.isArray(data?.candidates) && data.candidates.length > 0) {
      return { kind: "picker", choices: data.candidates as TenantChoice[] };
    }
    if (data?.user) return { kind: "user", user: data.user as CandidateUser };
    return { kind: "none" };
  } catch {
    return { kind: "none" };
  }
}

function readSessionUser(): CandidateUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CANDIDATE_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u?.id && u?.email && u?.tenantId && u?.candidateId) return u as CandidateUser;
  } catch {}
  return null;
}

function writeSessionUser(u: CandidateUser) {
  try {
    sessionStorage.setItem(SESSION_CANDIDATE_KEY, JSON.stringify(u));
    localStorage.setItem("candidate_user", JSON.stringify(u));
  } catch {}
}

function clearStoredCandidate() {
  try {
    sessionStorage.removeItem(SESSION_CANDIDATE_KEY);
    localStorage.removeItem("candidate_user");
  } catch {}
}

export function CandidateAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CandidateUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingTenantChoices, setPendingTenantChoices] = useState<TenantChoice[] | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session?.user) {
        clearStoredCandidate();
        setUser(null);
        setPendingTenantChoices(null);
        setLoading(false);
        return;
      }

      if (localStorage.getItem("preferred_portal") === "recruiter") {
        clearStoredCandidate();
        setUser(null);
        setLoading(false);
        return;
      }

      const sessionUser = readSessionUser();
      if (sessionUser && sessionUser.email.toLowerCase() === session.user.email?.toLowerCase()) {
        setUser(sessionUser);
        setPendingTenantChoices(null);
        setLoading(false);
        return;
      }

      const resolved = await resolveCandidateViaEdge();
      if (cancelled) return;

      if (resolved.kind === "user") {
        writeSessionUser(resolved.user);
        setUser(resolved.user);
        setPendingTenantChoices(null);
      } else if (resolved.kind === "picker") {
        clearStoredCandidate();
        setUser(null);
        setPendingTenantChoices(resolved.choices);
      } else {
        clearStoredCandidate();
        setUser(null);
        setPendingTenantChoices(null);
      }
      setLoading(false);
    };

    hydrate();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearStoredCandidate();
        setUser(null);
        setPendingTenantChoices(null);
        return;
      }
      if (event === "SIGNED_IN" && session?.user) {
        setTimeout(() => { hydrate(); }, 0);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        toast({
          title: "Login Failed",
          description: "Please check your email and password and try again.",
          variant: "destructive",
        });
        return { error: authError };
      }

      if (!authData?.user) return { error: new Error("No user") };

      const resolved = await resolveCandidateViaEdge();
      if (resolved.kind === "user") {
        writeSessionUser(resolved.user);
        setUser(resolved.user);
        setPendingTenantChoices(null);
        toast({ title: "Welcome back!", description: "You have been signed in successfully." });
        return { error: null };
      }
      if (resolved.kind === "picker") {
        clearStoredCandidate();
        setUser(null);
        setPendingTenantChoices(resolved.choices);
        return { error: null };
      }

      toast({
        title: "Login Failed",
        description: "Could not resolve your candidate profile.",
        variant: "destructive",
      });
      return { error: "Could not resolve candidate identity" };
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: "Please check your email and password and try again.",
        variant: "destructive",
      });
      return { error };
    }
  };

  const selectTenant = async (candidateId: string, tenantId: string) => {
    const { data, error } = await supabase.functions.invoke("select-candidate-tenant", {
      body: { candidateId, tenantId },
    });
    if (error || !data?.user) {
      toast({
        title: "Could not switch organization",
        description: "Please try again.",
        variant: "destructive",
      });
      throw error || new Error("No user returned");
    }
    const resolved = data.user as CandidateUser;
    writeSessionUser(resolved);
    localStorage.setItem("preferred_portal", "candidate");
    setPendingTenantChoices(null);
    setUser(resolved);
  };

  const setActiveCandidate = async (candidateId: string, tenantId: string) => {
    await selectTenant(candidateId, tenantId);
    window.dispatchEvent(new Event("candidate-tenant-changed"));
  };

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch {}
    clearStoredCandidate();
    localStorage.removeItem("preferred_portal");
    setUser(null);
    setPendingTenantChoices(null);
    window.location.href = "/auth";
  };

  return (
    <CandidateAuthContext.Provider value={{ user, signIn, signOut, loading, pendingTenantChoices, selectTenant, setActiveCandidate }}>
      {children}
    </CandidateAuthContext.Provider>
  );
}

export function useCandidateAuth() {
  const context = useContext(CandidateAuthContext);
  if (context === undefined) {
    throw new Error("useCandidateAuth must be used within a CandidateAuthProvider");
  }
  return context;
}
