import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AdminState = { loading: boolean; isAdmin: boolean; userId: string | null; email: string | null };

export function useIsAdmin(): AdminState {
  const [state, setState] = useState<AdminState>({ loading: true, isAdmin: false, userId: null, email: null });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session?.user) {
        setState({ loading: false, isAdmin: false, userId: null, email: null });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (cancelled) return;
      setState({
        loading: false,
        isAdmin: !!data,
        userId: session.user.id,
        email: session.user.email || null,
      });
    };

    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => check());
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  return state;
}
