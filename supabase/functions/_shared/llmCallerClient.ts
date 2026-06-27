// Tiny client used by every edge function that needs AI. Every AI call must go through llm-caller.
// Forwards the caller's JWT so usage logs against the real user.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

type Msg = { role: "system" | "user" | "assistant"; content: string };
type Base = {
  feature: string;
  messages: Msg[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
};

export function callLLMRaw(authHeader: string, payload: Record<string, unknown>): Promise<Response> {
  return fetch(`${SUPABASE_URL}/functions/v1/llm-caller`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader || `Bearer ${ANON}`,
      apikey: ANON,
    },
    body: JSON.stringify(payload),
  });
}

export async function callLLMChat(authHeader: string, req: Base): Promise<{ text: string; model?: string }> {
  const r = await callLLMRaw(authHeader, { mode: "chat", ...req });
  const j = await r.json();
  if (!j?.ok) throw new Error(j?.error || `llm-caller failed (${r.status})`);
  return { text: j.text || "", model: j.model };
}

export async function callLLMJson<T = unknown>(authHeader: string, req: Base): Promise<T> {
  const r = await callLLMRaw(authHeader, { mode: "json", ...req });
  const j = await r.json();
  if (!j?.ok) throw new Error(j?.error || `llm-caller failed (${r.status})`);
  const raw = String(j.text || "").trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(raw) as T; } catch { throw new Error("llm did not return JSON: " + raw.slice(0, 200)); }
}

export function callLLMStream(authHeader: string, req: Base): Promise<Response> {
  return callLLMRaw(authHeader, { mode: "stream", ...req });
}
