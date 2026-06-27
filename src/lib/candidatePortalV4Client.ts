import { supabase } from "@/integrations/supabase/client";

/**
 * Compatibility shim for legacy components that used to call the
 * `candidate-portal-v4-api` edge function in the ATS project. In this app the
 * portal talks to Supabase directly. Each known action is mapped here; unknown
 * actions return an empty success so legacy code does not crash.
 */
export async function invokeV4<T = any>(body: Record<string, any>): Promise<{ data: T | null; error: any }> {
  const action = body?.action as string | undefined;
  try {
    if (action === "get_profile") {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return { data: null, error: new Error("Not authenticated") };
      const { data: c, error } = await supabase
        .from("candidates")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) return { data: null, error };
      if (!c) return { data: null, error: new Error("Candidate row not found") };

      const fullName = (c as any).full_name || "";
      const [first, ...rest] = fullName.split(" ");
      const bootstrap = {
        candidate: {
          id: c.id,
          email: c.email,
          first_name: first || "",
          last_name: rest.join(" ") || "",
          phone: c.phone,
          photo_url: c.avatar_url,
          headline: c.headline,
          about: c.bio,
          location: c.location,
          resume_url: c.resume_url,
          skills_v4: (c.skills || []).map((s: string) => ({ name: s })),
          xp_total: c.xp_total || 0,
          streak_days: c.streak_days || 0,
          profile_completeness: 0,
          ...((c.profile_extra as any) || {}),
        },
        credits: { balance: 0, lifetime_earned: 0 },
        today_attempts: 0,
        daily_limit: 50,
      };
      return { data: bootstrap as any, error: null };
    }
    if (action === "list_my_tenants") {
      return { data: { tenants: [] } as any, error: null };
    }
    return { data: {} as any, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
