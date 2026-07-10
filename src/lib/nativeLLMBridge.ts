// Bridge between the web app (running inside a React Native WebView) and an
// on-device LLM hosted by the native shell. See .lovable/plan.md.
//
// Protocol (JSON over window.ReactNativeWebView.postMessage):
//   Web -> RN: { type: "llm.request", id, payload: { messages, feature, model?, temperature?, max_tokens?, stream? } }
//   Web -> RN: { type: "llm.capabilities?" }
//   RN  -> Web: injectJavaScript(`window.__RN_LLM__.resolve("<id>", "<text>")`)
//   RN  -> Web: injectJavaScript(`window.__RN_LLM__.reject("<id>", "<err>")`)
//   RN  -> Web: injectJavaScript(`window.__RN_LLM__.capabilities({ features: [...], models: [...] })`)
//
// Streaming (payload.stream === true). RN batches tokens (~60ms or ~5 tokens,
// whichever comes first) rather than injecting per token, then closes with done():
//   RN  -> Web: injectJavaScript(`window.__RN_LLM__.chunk("<id>", "<delta>")`)
//   RN  -> Web: injectJavaScript(`window.__RN_LLM__.done("<id>")`)
//
// A streaming request's timeout is re-armed on every chunk, so `timeoutMs` is an
// idle budget there, not a total one. Non-streaming keeps a single absolute deadline.

import type { LLMMessage } from "./llmClient";

type Pending = {
  resolve: (text: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  timeoutMs: number;
  acc: string;
  onChunk?: (delta: string) => void;
};

type Capabilities = { features: string[]; models: string[]; ready: boolean };

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __IS_SUDOMENTOR_NATIVE__?: boolean;
    __RN_LLM__?: {
      resolve: (id: string, text: string) => void;
      reject: (id: string, err: string) => void;
      chunk: (id: string, delta: string) => void;
      done: (id: string) => void;
      capabilities: (caps: Capabilities) => void;
    };
  }
}

const pending = new Map<string, Pending>();
let caps: Capabilities = { features: [], models: [], ready: false };
let installed = false;

// Streaming replies re-arm the deadline on every chunk, so a slow-but-alive
// model is never killed mid-answer.
function rearm(id: string, p: Pending) {
  clearTimeout(p.timer);
  p.timer = setTimeout(() => {
    pending.delete(id);
    p.reject(new Error("native llm timeout"));
  }, p.timeoutMs);
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.__RN_LLM__ = {
    resolve(id, text) {
      const p = pending.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(id);
      p.resolve(text);
    },
    reject(id, err) {
      const p = pending.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(id);
      p.reject(new Error(err || "native llm error"));
    },
    chunk(id, delta) {
      const p = pending.get(id);
      if (!p) return;
      rearm(id, p);
      p.acc += delta;
      p.onChunk?.(delta);
    },
    done(id) {
      const p = pending.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(id);
      p.resolve(p.acc);
    },
    capabilities(next) {
      caps = { features: [], models: [], ready: false, ...next };
    },
  };
  // Ask RN what it supports (best-effort; RN may reply asynchronously).
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "llm.capabilities?" }));
  } catch {
    // no-op
  }
}

export function isInNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.ReactNativeWebView) || window.__IS_SUDOMENTOR_NATIVE__ === true;
}

export function nativeBridgeReady(): boolean {
  install();
  return isInNativeApp() && caps.ready;
}

export function nativeSupportsFeature(feature: string): boolean {
  install();
  if (!isInNativeApp() || !caps.ready) return false;
  return caps.features.length === 0 ? true : caps.features.includes(feature);
}

export type NativeLLMRequest = {
  feature: string;
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
};

function request(
  req: NativeLLMRequest,
  timeoutMs: number,
  onChunk?: (delta: string) => void,
): Promise<string> {
  install();
  if (!isInNativeApp()) return Promise.reject(new Error("not running inside native app"));
  const bridge = window.ReactNativeWebView;
  if (!bridge) return Promise.reject(new Error("ReactNativeWebView bridge missing"));

  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const stream = Boolean(onChunk);
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("native llm timeout"));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer, timeoutMs, acc: "", onChunk });
    try {
      bridge.postMessage(
        JSON.stringify({ type: "llm.request", id, payload: { ...req, stream } }),
      );
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/** One-shot: native replies once via `__RN_LLM__.resolve(id, text)`. */
export function callNativeLLM(req: NativeLLMRequest, timeoutMs = 45_000): Promise<string> {
  return request(req, timeoutMs);
}

/**
 * Streaming: native pushes batched deltas via `__RN_LLM__.chunk(id, delta)` and
 * closes with `__RN_LLM__.done(id)`. Resolves with the full accumulated text.
 * `timeoutMs` is the idle gap allowed between chunks, not a total budget.
 */
export function streamNativeLLM(
  req: NativeLLMRequest,
  onChunk: (delta: string) => void,
  timeoutMs = 45_000,
): Promise<string> {
  return request(req, timeoutMs, onChunk);
}

// User-facing override switch (localStorage flag). Defaults to on when bridge is available.
const LS_KEY = "sudomentor.useOnDeviceLLM";
export function onDeviceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const v = window.localStorage?.getItem(LS_KEY);
  if (v === "0" || v === "false") return false;
  return true;
}

// Install eagerly so RN can call into window.__RN_LLM__ as soon as the bundle loads.
install();
