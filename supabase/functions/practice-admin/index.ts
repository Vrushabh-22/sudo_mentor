// Admin-only CRUD for the practice content tree (pillars / subtopics / prompts / items)
// plus on-demand LLM sample generation routed through the central llm-caller.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { callLLMJson } from "../_shared/llmCallerClient.ts";

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
    const action = String(body.action || "");

    // ---------- pillars ----------
    if (action === "list_pillars") {
      const { data, error } = await admin.from("practice_pillars").select("*").order("sort_order");
      if (error) throw error;
      return json({ ok: true, pillars: data });
    }
    if (action === "upsert_pillar") {
      const p = body.pillar || {};
      const { data, error } = await admin.from("practice_pillars").upsert(p).select("*").single();
      if (error) throw error;
      return json({ ok: true, pillar: data });
    }
    if (action === "delete_pillar") {
      const { error } = await admin.from("practice_pillars").delete().eq("id", body.id);
      if (error) throw error;
      return json({ ok: true });
    }

    // ---------- subtopics ----------
    if (action === "list_subtopics") {
      const { data, error } = await admin.from("practice_subtopics").select("*")
        .eq("pillar_id", body.pillar_id).order("sort_order");
      if (error) throw error;
      return json({ ok: true, subtopics: data });
    }
    if (action === "upsert_subtopic") {
      const s = body.subtopic || {};
      const { data, error } = await admin.from("practice_subtopics").upsert(s).select("*").single();
      if (error) throw error;
      return json({ ok: true, subtopic: data });
    }
    if (action === "delete_subtopic") {
      const { error } = await admin.from("practice_subtopics").delete().eq("id", body.id);
      if (error) throw error;
      return json({ ok: true });
    }

    // ---------- prompts ----------
    if (action === "list_prompts") {
      const { data, error } = await admin.from("practice_prompts").select("*")
        .eq("subtopic_id", body.subtopic_id).order("created_at");
      if (error) throw error;
      return json({ ok: true, prompts: data });
    }
    if (action === "upsert_prompt") {
      const p = body.prompt || {};
      const { data, error } = await admin.from("practice_prompts").upsert(p).select("*").single();
      if (error) throw error;
      return json({ ok: true, prompt: data });
    }
    if (action === "delete_prompt") {
      const { error } = await admin.from("practice_prompts").delete().eq("id", body.id);
      if (error) throw error;
      return json({ ok: true });
    }

    // ---------- items ----------
    if (action === "list_items") {
      let q = admin.from("practice_items").select("*").eq("subtopic_id", body.subtopic_id)
        .order("created_at", { ascending: false }).limit(200);
      if (body.status) q = q.eq("status", body.status);
      const { data, error } = await q;
      if (error) throw error;
      return json({ ok: true, items: data });
    }
    if (action === "upsert_item") {
      const i = { ...(body.item || {}), created_by: userRes.user.id };
      const { data, error } = await admin.from("practice_items").upsert(i).select("*").single();
      if (error) throw error;
      return json({ ok: true, item: data });
    }
    if (action === "set_item_status") {
      const { error } = await admin.from("practice_items").update({ status: body.status }).eq("id", body.id);
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "delete_item") {
      const { error } = await admin.from("practice_items").delete().eq("id", body.id);
      if (error) throw error;
      return json({ ok: true });
    }

    // ---------- LLM sample generation ----------
    if (action === "generate_sample") {
      const { prompt_id, vars } = body;
      const { data: pr, error: pe } = await admin.from("practice_prompts").select("*").eq("id", prompt_id).single();
      if (pe || !pr) throw pe || new Error("prompt not found");

      const v = vars || {};
      const filled = String(pr.user_prompt_template || "")
        .replaceAll("{candidate_stream}", v.stream || "general")
        .replaceAll("{difficulty}", v.difficulty || "medium")
        .replaceAll("{recent_topics}", (v.recent_topics || []).join(", "));

      const sys = pr.system_prompt || `You generate a single ${pr.kind} practice item as strict JSON. No prose, no markdown fences.`;
      const schemaHint = pr.schema_json
        ? `\n\nReturn JSON matching this schema:\n${JSON.stringify(pr.schema_json)}`
        : pr.kind === "mcq"
          ? `\n\nReturn JSON: { "question": string, "options": string[4], "correct_index": 0-3, "explanation": string }`
          : `\n\nReturn JSON: { "prompt": string, "rubric": string[] }`;

      const messages = [
        { role: "system" as const, content: sys + schemaHint },
        ...(Array.isArray(pr.few_shot) ? pr.few_shot.flatMap((ex: any) => [
          { role: "user" as const, content: String(ex.input || "") },
          { role: "assistant" as const, content: JSON.stringify(ex.output || {}) },
        ]) : []),
        { role: "user" as const, content: filled || "Generate one item." },
      ];

      const payload = await callLLMJson<any>(authHeader, {
        feature: `practice.sample.${pr.kind}`,
        messages,
        model: pr.model_override || undefined,
        temperature: Number(pr.temperature ?? 0.7),
      });

      return json({ ok: true, payload });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

function json(p: unknown, status = 200) {
  return new Response(JSON.stringify(p), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
