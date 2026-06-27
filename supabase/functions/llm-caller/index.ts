// Central LLM gateway. Every AI call in the portal MUST go through this function.
// - Loads the active provider + a round-robin selected, non-cooling key from the DB
// - Adapts the request to the provider's wire format (OpenAI-compatible / Azure / Anthropic / Gemini)
// - Supports chat, json, stream modes
// - Optional response cache (cache.ttl_seconds)
// - Cools down failing keys on 429/5xx and retries the next eligible key
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptApiKey } from "../_shared/llmCrypto.ts";

type Message = { role: "system" | "user" | "assistant"; content: string };
type Body = {
  feature: string;
  mode?: "chat" | "json" | "stream";
  messages: Message[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: unknown;
  cache?: { ttl_seconds: number };
};

const MAX_KEY_RETRIES = 3;
const COOLDOWN_MINUTES = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  // Auth — any signed-in user (candidate or admin)
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return j({ error: "unauthorized" }, 401);
  const userId = userRes.user.id;

  let body: Body;
  try { body = await req.json(); } catch { return j({ error: "invalid json" }, 400); }
  if (!body?.feature || !Array.isArray(body.messages)) return j({ error: "missing feature/messages" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const mode = body.mode || "chat";

  // ---------- cache lookup ----------
  let cacheKey: string | null = null;
  if (mode !== "stream" && body.cache?.ttl_seconds && body.cache.ttl_seconds > 0) {
    cacheKey = await sha256Hex(JSON.stringify({ f: body.feature, m: body.model, t: body.temperature, msgs: body.messages }));
    const { data: cached } = await admin.from("llm_cache").select("response, expires_at").eq("cache_key", cacheKey).maybeSingle();
    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      await admin.rpc("llm_record_call", {
        _provider_id: null, _key_id: null, _feature: body.feature, _model: body.model ?? null,
        _status: 200, _latency_ms: 0, _prompt_tokens: null, _completion_tokens: null,
        _cache_hit: true, _error: null, _user_id: userId,
      });
      return j({ ok: true, cached: true, ...(cached.response as object) });
    }
  }

  // ---------- attempt loop with key rotation ----------
  const triedKeys = new Set<string>();
  let lastErr = "no eligible key";

  for (let attempt = 0; attempt < MAX_KEY_RETRIES; attempt++) {
    const { data: picks, error: pickErr } = await admin.rpc("llm_pick_next_key");
    if (pickErr) return j({ error: pickErr.message }, 500);
    const pick = Array.isArray(picks) ? picks[0] : picks;
    if (!pick?.key_id) {
      lastErr = "no active provider/key configured";
      break;
    }
    if (triedKeys.has(pick.key_id)) break;
    triedKeys.add(pick.key_id);

    const apiKey = await decryptApiKey(pick.ciphertext, pick.iv);
    const model = body.model || pick.default_model || "gpt-4o-mini";
    const started = Date.now();

    try {
      const adapter = buildAdapter(pick.provider_slug, pick.base_url, pick.config || {}, apiKey);
      if (mode === "stream") {
        const resp = await adapter.stream({ model, messages: body.messages, temperature: body.temperature, max_tokens: body.max_tokens });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          if (resp.status === 429 || resp.status >= 500) {
            await admin.rpc("llm_cooldown_key", { _key_id: pick.key_id, _minutes: COOLDOWN_MINUTES });
            await logCall(admin, pick, body, model, resp.status, Date.now() - started, errText, userId);
            lastErr = `provider ${resp.status}: ${errText.slice(0, 200)}`;
            continue;
          }
          await logCall(admin, pick, body, model, resp.status, Date.now() - started, errText, userId);
          return new Response(errText || JSON.stringify({ error: "provider error" }), {
            status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await logCall(admin, pick, body, model, 200, Date.now() - started, null, userId);
        return new Response(resp.body, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
        });
      }

      const result = await adapter.complete({
        model, messages: body.messages, temperature: body.temperature, max_tokens: body.max_tokens, json: mode === "json",
      });
      const latency = Date.now() - started;
      if (!result.ok) {
        if (result.status === 429 || result.status >= 500) {
          await admin.rpc("llm_cooldown_key", { _key_id: pick.key_id, _minutes: COOLDOWN_MINUTES });
          await logCall(admin, pick, body, model, result.status, latency, result.error, userId);
          lastErr = `provider ${result.status}: ${(result.error || "").slice(0, 200)}`;
          continue;
        }
        await logCall(admin, pick, body, model, result.status, latency, result.error, userId);
        return j({ error: result.error || "provider error", status: result.status }, result.status);
      }

      await admin.rpc("llm_record_call", {
        _provider_id: pick.provider_id, _key_id: pick.key_id, _feature: body.feature, _model: model,
        _status: 200, _latency_ms: latency,
        _prompt_tokens: result.usage?.prompt_tokens ?? null,
        _completion_tokens: result.usage?.completion_tokens ?? null,
        _cache_hit: false, _error: null, _user_id: userId,
      });

      const payload = { ok: true, text: result.text, model, provider: pick.provider_slug, usage: result.usage };
      if (cacheKey) {
        const expires = new Date(Date.now() + body.cache!.ttl_seconds * 1000).toISOString();
        await admin.from("llm_cache").upsert({ cache_key: cacheKey, response: payload, model, expires_at: expires });
      }
      return j(payload);
    } catch (e) {
      lastErr = String((e as Error).message || e);
      await logCall(admin, pick, body, model, 0, Date.now() - started, lastErr, userId);
      await admin.rpc("llm_cooldown_key", { _key_id: pick.key_id, _minutes: COOLDOWN_MINUTES });
      continue;
    }
  }

  return j({ error: lastErr }, 503);
});

// ---------------- adapters ----------------
type CompleteArgs = { model: string; messages: Message[]; temperature?: number; max_tokens?: number; json?: boolean };
type CompleteResult = { ok: true; text: string; usage?: { prompt_tokens?: number; completion_tokens?: number } } | { ok: false; status: number; error: string };

interface Adapter {
  complete(args: CompleteArgs): Promise<CompleteResult>;
  stream(args: Omit<CompleteArgs, "json">): Promise<Response>;
}

function buildAdapter(slug: string, baseUrl: string | null, config: Record<string, unknown>, apiKey: string): Adapter {
  if (slug === "azure_openai") return azureAdapter(baseUrl, config, apiKey);
  if (slug === "anthropic") return anthropicAdapter(baseUrl || "https://api.anthropic.com/v1", apiKey);
  if (slug === "gemini") return geminiAdapter(baseUrl || "https://generativelanguage.googleapis.com/v1beta", apiKey);
  // openai, groq, lovable, or anything OpenAI-compatible
  return openAICompatAdapter(slug, baseUrl || "https://api.openai.com/v1", apiKey);
}

function openAICompatAdapter(slug: string, baseUrl: string, apiKey: string): Adapter {
  const url = baseUrl.replace(/\/$/, "") + "/chat/completions";
  const authHeaders: Record<string, string> = slug === "lovable"
    ? { "Lovable-API-Key": apiKey }
    : { "Authorization": `Bearer ${apiKey}` };

  return {
    async complete({ model, messages, temperature, max_tokens, json }) {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          model, messages, temperature, max_tokens,
          ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!r.ok) return { ok: false, status: r.status, error: await r.text() };
      const data = await r.json();
      return { ok: true, text: data.choices?.[0]?.message?.content ?? "", usage: data.usage };
    },
    stream({ model, messages, temperature, max_tokens }) {
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ model, messages, temperature, max_tokens, stream: true }),
      });
    },
  };
}

function azureAdapter(baseUrl: string | null, config: Record<string, unknown>, apiKey: string): Adapter {
  const endpoint = (baseUrl || "").replace(/\/$/, "");
  const deployment = String(config.deployment || "");
  const apiVersion = String(config.api_version || "2024-08-01-preview");
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const headers = { "Content-Type": "application/json", "api-key": apiKey };

  return {
    async complete({ messages, temperature, max_tokens, json }) {
      const r = await fetch(url, {
        method: "POST", headers,
        body: JSON.stringify({
          messages, temperature, max_tokens,
          ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!r.ok) return { ok: false, status: r.status, error: await r.text() };
      const data = await r.json();
      return { ok: true, text: data.choices?.[0]?.message?.content ?? "", usage: data.usage };
    },
    stream({ messages, temperature, max_tokens }) {
      return fetch(url, {
        method: "POST", headers,
        body: JSON.stringify({ messages, temperature, max_tokens, stream: true }),
      });
    },
  };
}

function anthropicAdapter(baseUrl: string, apiKey: string): Adapter {
  const url = baseUrl.replace(/\/$/, "") + "/messages";
  const headers = { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  const toAnthropic = (messages: Message[]) => {
    const sys = messages.filter(m => m.role === "system").map(m => m.content).join("\n") || undefined;
    const conv = messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));
    return { system: sys, messages: conv };
  };
  return {
    async complete({ model, messages, temperature, max_tokens }) {
      const { system, messages: conv } = toAnthropic(messages);
      const r = await fetch(url, {
        method: "POST", headers,
        body: JSON.stringify({ model, system, messages: conv, max_tokens: max_tokens ?? 1024, temperature }),
      });
      if (!r.ok) return { ok: false, status: r.status, error: await r.text() };
      const data = await r.json();
      const text = (data.content || []).map((b: { text?: string }) => b.text || "").join("");
      return { ok: true, text, usage: { prompt_tokens: data.usage?.input_tokens, completion_tokens: data.usage?.output_tokens } };
    },
    async stream(args) {
      // Streaming via Anthropic SSE; passthrough.
      const { system, messages: conv } = toAnthropic(args.messages);
      return fetch(url, {
        method: "POST", headers,
        body: JSON.stringify({ model: args.model, system, messages: conv, max_tokens: args.max_tokens ?? 1024, temperature: args.temperature, stream: true }),
      });
    },
  };
}

function geminiAdapter(baseUrl: string, apiKey: string): Adapter {
  const root = baseUrl.replace(/\/$/, "");
  const toGemini = (messages: Message[]) => ({
    systemInstruction: messages.filter(m => m.role === "system").length
      ? { parts: [{ text: messages.filter(m => m.role === "system").map(m => m.content).join("\n") }] }
      : undefined,
    contents: messages.filter(m => m.role !== "system").map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  });
  return {
    async complete({ model, messages, temperature, max_tokens, json }) {
      const url = `${root}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const payload = toGemini(messages);
      const r = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          generationConfig: { temperature, maxOutputTokens: max_tokens, ...(json ? { responseMimeType: "application/json" } : {}) },
        }),
      });
      if (!r.ok) return { ok: false, status: r.status, error: await r.text() };
      const data = await r.json();
      const text = (data.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
      return { ok: true, text, usage: { prompt_tokens: data.usageMetadata?.promptTokenCount, completion_tokens: data.usageMetadata?.candidatesTokenCount } };
    },
    async stream({ model, messages, temperature, max_tokens }) {
      const url = `${root}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
      const payload = toGemini(messages);
      return fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, generationConfig: { temperature, maxOutputTokens: max_tokens } }),
      });
    },
  };
}

// ---------------- helpers ----------------
async function logCall(admin: ReturnType<typeof createClient>, pick: { provider_id?: string; key_id?: string } | null, body: Body, model: string, status: number, latency: number, err: string | null, userId: string) {
  await admin.rpc("llm_record_call", {
    _provider_id: pick?.provider_id ?? null,
    _key_id: pick?.key_id ?? null,
    _feature: body.feature,
    _model: model,
    _status: status,
    _latency_ms: latency,
    _prompt_tokens: null, _completion_tokens: null,
    _cache_hit: false, _error: err,
    _user_id: userId,
  });
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function j(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
