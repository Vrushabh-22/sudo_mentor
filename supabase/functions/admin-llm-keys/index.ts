// Admin-only CRUD for the LLM API key pool. Encrypts raw keys server-side and never returns plaintext.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { encryptApiKey } from "../_shared/llmCrypto.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  // 1) Verify caller is an admin
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return json({ error: "unauthorized" }, 401);
  const { data: roles } = await userClient
    .from("user_roles").select("role").eq("user_id", userRes.user.id).eq("role", "admin").limit(1);
  if (!roles || roles.length === 0) return json({ error: "forbidden" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "list") {
      const { data, error } = await admin
        .from("llm_api_keys")
        .select("id, provider_id, label, key_last4, enabled, weight, last_used_at, use_count, fail_count, cooldown_until, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ ok: true, keys: data });
    }

    if (action === "create") {
      const { provider_id, label, api_key, weight } = body;
      if (!provider_id || !label || !api_key) return json({ error: "missing fields" }, 400);
      const { ciphertext, iv, last4 } = await encryptApiKey(String(api_key));
      const { data, error } = await admin
        .from("llm_api_keys")
        .insert({
          provider_id, label, key_ciphertext: ciphertext, key_iv: iv, key_last4: last4,
          weight: Number(weight) > 0 ? Number(weight) : 1,
        })
        .select("id").single();
      if (error) throw error;
      return json({ ok: true, id: data.id });
    }

    if (action === "update") {
      const { id, enabled, weight, label } = body;
      if (!id) return json({ error: "missing id" }, 400);
      const patch: Record<string, unknown> = {};
      if (typeof enabled === "boolean") patch.enabled = enabled;
      if (typeof weight === "number") patch.weight = weight;
      if (typeof label === "string") patch.label = label;
      const { error } = await admin.from("llm_api_keys").update(patch).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete") {
      const { id } = body;
      if (!id) return json({ error: "missing id" }, 400);
      const { error } = await admin.from("llm_api_keys").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "clear_cooldown") {
      const { id } = body;
      if (!id) return json({ error: "missing id" }, 400);
      const { error } = await admin.from("llm_api_keys").update({ cooldown_until: null, fail_count: 0 }).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
