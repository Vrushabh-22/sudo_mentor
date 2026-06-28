// Admin-only CRUD for Azure Blob Storage account + container mappings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { encryptApiKey } from "../_shared/llmCrypto.ts";
import { invalidateAzureCache, testAzureConnection } from "../_shared/azureStorage.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

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
      const { data: account } = await admin
        .from("azure_storage_accounts")
        .select("id, label, account_name, connection_last4, is_active, enabled, created_at, updated_at")
        .eq("is_active", true)
        .maybeSingle();
      const { data: containers } = await admin
        .from("azure_storage_containers")
        .select("id, account_id, purpose, container_name, public_read, enabled, created_at, updated_at")
        .order("purpose");
      return json({ ok: true, account, containers: containers || [] });
    }

    if (action === "set_account") {
      const { label, connection_string } = body;
      if (!label || !connection_string) return json({ error: "missing fields" }, 400);
      const test = await testAzureConnection(String(connection_string));
      if (!test.ok) return json({ error: test.error || "invalid connection string" }, 400);
      const { ciphertext, iv, last4 } = await encryptApiKey(String(connection_string));

      // Deactivate any existing active account, then insert new one
      await admin.from("azure_storage_accounts").update({ is_active: false }).eq("is_active", true);
      const { data, error } = await admin
        .from("azure_storage_accounts")
        .insert({
          label,
          account_name: test.accountName!,
          connection_string_ciphertext: ciphertext,
          connection_string_iv: iv,
          connection_last4: last4,
          is_active: true,
          enabled: true,
        })
        .select("id").single();
      if (error) throw error;
      invalidateAzureCache();
      return json({ ok: true, id: data.id, account_name: test.accountName });
    }

    if (action === "upsert_container") {
      const { account_id, purpose, container_name, public_read } = body;
      if (!account_id || !purpose || !container_name) return json({ error: "missing fields" }, 400);
      const { error } = await admin
        .from("azure_storage_containers")
        .upsert({
          account_id,
          purpose: String(purpose),
          container_name: String(container_name),
          public_read: !!public_read,
          enabled: true,
        }, { onConflict: "purpose" });
      if (error) throw error;
      invalidateAzureCache(String(purpose));
      return json({ ok: true });
    }

    if (action === "update_container") {
      const { id, enabled, container_name, public_read } = body;
      if (!id) return json({ error: "missing id" }, 400);
      const patch: Record<string, unknown> = {};
      if (typeof enabled === "boolean") patch.enabled = enabled;
      if (typeof container_name === "string") patch.container_name = container_name;
      if (typeof public_read === "boolean") patch.public_read = public_read;
      const { data, error } = await admin.from("azure_storage_containers").update(patch).eq("id", id).select("purpose").single();
      if (error) throw error;
      if (data?.purpose) invalidateAzureCache(data.purpose);
      return json({ ok: true });
    }

    if (action === "delete_container") {
      const { id } = body;
      if (!id) return json({ error: "missing id" }, 400);
      const { data } = await admin.from("azure_storage_containers").select("purpose").eq("id", id).maybeSingle();
      const { error } = await admin.from("azure_storage_containers").delete().eq("id", id);
      if (error) throw error;
      if (data?.purpose) invalidateAzureCache(data.purpose);
      return json({ ok: true });
    }

    if (action === "test_connection") {
      const { connection_string } = body;
      if (!connection_string) return json({ error: "missing connection string" }, 400);
      const r = await testAzureConnection(String(connection_string));
      return json(r, r.ok ? 200 : 400);
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
