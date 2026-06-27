// Idempotent super-admin bootstrap.
// Creates akshay.deshmukh@techademy.com with a fixed initial password (if missing)
// and ensures the 'admin' role row exists. Safe to call multiple times.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAIL = "akshay.deshmukh@techademy.com";
const SUPER_ADMIN_PASSWORD = "Akshay1234$$";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 1. Look up user by email.
    let userId: string | null = null;
    {
      // listUsers is paginated; we filter client-side by email.
      // For a single bootstrap user this is fine; in production we'd use a dedicated lookup.
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) throw error;
      const existing = data.users.find((u) => (u.email || "").toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
      if (existing) userId = existing.id;
    }

    // 2. Create user if missing (email pre-confirmed).
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Akshay Deshmukh" },
      });
      if (error) throw error;
      userId = data.user!.id;
    }

    // 3. Ensure admin role assignment.
    const { error: roleErr } = await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleErr) throw roleErr;

    return new Response(JSON.stringify({ ok: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
