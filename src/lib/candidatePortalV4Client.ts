import { supabase } from "@/integrations/supabase/client";
import { computeProfileCompleteness } from "@/lib/profileCompleteness";

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
          skills_v4: Array.isArray((c as any).skills_v4) && (c as any).skills_v4.length
            ? (c as any).skills_v4
            : (c.skills || []).map((s: string) => ({ name: s })),
          stream: (c as any).stream,
          branch: (c as any).branch,
          institution: (c as any).institution,
          graduation_year: (c as any).graduation_year,
          cgpa: (c as any).cgpa,
          xp_total: c.xp_total || 0,
          streak_days: c.streak_days || 0,
          profile_completeness: (c as any).profile_completeness ?? 0,
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
    if (action === "patch_profile") {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return { data: null, error: new Error("Not authenticated") };

      // Whitelist of direct columns on public.candidates
      const COLS = new Set([
        "first_name", "last_name", "phone", "headline", "location",
        "avatar_url", "resume_url", "resume_filename",
        "stream", "branch", "institution", "graduation_year", "cgpa",
        "skills_v4", "skills", "profile_completeness", "full_name",
      ]);
      // Field renames coming from legacy V4 payloads
      const RENAME: Record<string, string> = {
        about: "bio",
        photo_url: "avatar_url",
      };

      const { action: _ignored, ...input } = body;
      const update: Record<string, any> = {};
      const extra: Record<string, any> = {};

      for (const [k, v] of Object.entries(input)) {
        if (v === undefined) continue;
        const key = RENAME[k] || k;
        if (key === "bio" || COLS.has(key)) {
          update[key] = v;
        } else {
          extra[key] = v;
        }
      }

      // Mirror skills_v4 names into the text[] skills column for backward compat
      if (Array.isArray(update.skills_v4) && !update.skills) {
        update.skills = update.skills_v4
          .map((s: any) => (typeof s === "string" ? s : s?.name))
          .filter((s: any) => typeof s === "string" && s.length > 0);
      }

      // Fetch existing row to (a) merge profile_extra and (b) recompute completeness
      const { data: existing } = await supabase
        .from("candidates")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (Object.keys(extra).length > 0) {
        update.profile_extra = { ...((existing as any)?.profile_extra || {}), ...extra };
      }

      // Compute completeness from the merged candidate snapshot
      const merged = { ...((existing as any) || {}), ...update };
      update.profile_completeness = computeProfileCompleteness(merged);

      if (Object.keys(update).length === 0) {
        return { data: { ok: true } as any, error: null };
      }

      const { error } = await supabase
        .from("candidates")
        .update(update as any)
        .eq("user_id", session.user.id);
      if (error) return { data: null, error };
      return { data: { ok: true } as any, error: null };
    }
    return { data: {} as any, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
