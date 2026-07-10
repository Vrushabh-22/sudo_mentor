// Browser-side helper. Every UI surface that needs AI must call this — never call providers directly.
import { supabase } from "@/integrations/supabase/client";
import {
  callNativeLLM,
  isInNativeApp,
  nativeSupportsFeature,
  onDeviceEnabled,
} from "./nativeLLMBridge";

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

// Features allowed to run on the on-device model when the native bridge is present.
const NATIVE_FEATURE_ALLOWLIST = new Set<string>([
  "project_mentor_chat",
  "mentor_copilot_chat",
]);

export function shouldUseNative(feature: string): boolean {
  return (
    isInNativeApp() &&
    onDeviceEnabled() &&
    NATIVE_FEATURE_ALLOWLIST.has(feature) &&
    nativeSupportsFeature(feature)
  );
}

export async function callLLM(req: LLMRequest): Promise<{ text: string; model: string; provider: string }> {
  if (shouldUseNative(req.feature)) {
    try {
      const text = await callNativeLLM({
        feature: req.feature,
        messages: req.messages,
        model: req.model,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
      });
      return { text, model: req.model || "on-device", provider: "native" };
    } catch (e) {
      console.warn("[llmClient] native bridge failed, falling back to cloud", e);
    }
  }
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
// Streaming stays cloud-only in v1 — bridging SSE through the WebView is future work.
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

// Re-export bridge helpers for UI surfaces that want to show an "on-device" indicator,
// or that own their own cloud fallback and so cannot route through callLLM.
export {
  isInNativeApp,
  nativeSupportsFeature,
  onDeviceEnabled,
  streamNativeLLM,
} from "./nativeLLMBridge";
