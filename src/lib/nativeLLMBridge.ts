// Bridge between the web app (running inside a React Native WebView) and an
// on-device LLM hosted by the native shell. See .lovable/plan.md.
//
// Protocol (JSON over window.ReactNativeWebView.postMessage):
//   Web -> RN: { type: "llm.request", id, payload: { messages, feature, model?, temperature?, max_tokens? } }
//   Web -> RN: { type: "llm.capabilities?" }
//   RN  -> Web: injectJavaScript(`window.__RN_LLM__.resolve("<id>", "<text>")`)
//   RN  -> Web: injectJavaScript(`window.__RN_LLM__.reject("<id>", "<err>")`)
//   RN  -> Web: injectJavaScript(`window.__RN_LLM__.capabilities({ features: [...], models: [...] })`)

import type { LLMMessage } from "./llmClient";

type Pending = {
  resolve: (text: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type Capabilities = { features: string[]; models: string[]; ready: boolean };

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __IS_SUDOMENTOR_NATIVE__?: boolean;
    __RN_LLM__?: {
      resolve: (id: string, text: string) => void;
      reject: (id: string, err: string) => void;
      capabilities: (caps: Capabilities) => void;
    };
  }
}

const pending = new Map<string, Pending>();
let caps: Capabilities = { features: [], models: [], ready: false };
let installed = false;

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

export function callNativeLLM(req: NativeLLMRequest, timeoutMs = 45_000): Promise<string> {
  install();
  if (!isInNativeApp()) return Promise.reject(new Error("not running inside native app"));
  const bridge = window.ReactNativeWebView;
  if (!bridge) return Promise.reject(new Error("ReactNativeWebView bridge missing"));

  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("native llm timeout"));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    try {
      bridge.postMessage(JSON.stringify({ type: "llm.request", id, payload: req }));
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
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
