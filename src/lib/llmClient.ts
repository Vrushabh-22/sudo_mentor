// Browser-side helper. Every UI surface that needs AI must call this — never call providers directly.
import { supabase } from "@/integrations/supabase/client";

export type LLMMessage = { role: "system" | "user" | "assistant"; content: string };
export type LLMRequest = {
  feature: string;
  mode?: "chat" | "json" | "stream";
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  cache?: { ttl_seconds: number };
};

export async function callLLM(req: LLMRequest): Promise<{ text: string; model: string; provider: string }> {
  const { data, error } = await supabase.functions.invoke("llm-caller", { body: { mode: "chat", ...req } });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || "llm failure");
  return { text: data.text, model: data.model, provider: data.provider };
}

export async function callLLMJson<T = unknown>(req: Omit<LLMRequest, "mode">): Promise<T> {
  const { data, error } = await supabase.functions.invoke("llm-caller", { body: { mode: "json", ...req } });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || "llm failure");
  try { return JSON.parse(data.text) as T; } catch { throw new Error("llm did not return JSON"); }
}

// Streaming: returns a ReadableStream of raw provider SSE bytes. Caller parses tokens.
export async function streamLLM(req: Omit<LLMRequest, "mode">): Promise<Response> {
  const session = (await supabase.auth.getSession()).data.session;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/llm-caller`;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ mode: "stream", ...req }),
  });
}
