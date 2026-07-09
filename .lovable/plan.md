
# On-device LLM via React Native WebView bridge

Your native app already wraps `sudomentor.com` in a `WebView`. We can add a bridge so the web app, when it detects it's running inside the shell, hands mentor prompts to the RN side, which runs them against a locally hosted model and returns the reply. Cloud (`llm-caller`) stays the fallback.

## How the bridge works

```text
Web (React)                    WebView bridge                     React Native
────────────                   ──────────────                    ──────────────
callLLM({messages})   ──►  window.ReactNativeWebView             onMessage(evt)
                              .postMessage(JSON)         ──►     runs local model
                                                                 (llama.rn / MLC / Ollama)
window.__RN_LLM__.resolve(id, text)  ◄──  webViewRef.injectJavaScript(...)
```

- Web posts a request with a correlation `id`.
- RN receives it in `onMessage`, runs the model, and injects a JS call back into the WebView with the answer for that `id`.
- Web resolves the pending promise.

## Changes in the web app (this repo)

1. **New `src/lib/nativeLLMBridge.ts`**
   - `isInNativeApp()` — true when `window.ReactNativeWebView` exists (or a UA marker we set from RN).
   - `callNativeLLM({ messages, feature, model?, temperature?, max_tokens? }, timeoutMs)` — creates a `id`, stores a `{resolve, reject}` in a map, posts `{ type: "llm.request", id, payload }` to RN, times out (e.g. 45s) with rejection.
   - Installs `window.__RN_LLM__ = { resolve(id, text), reject(id, err), capabilities(caps) }` once, so RN can push results and advertise which models it supports.

2. **`src/lib/llmClient.ts`** — inside `callLLM` / `callLLMJson`:
   - If `isInNativeApp()` and (a) feature is in an allowlist and (b) RN has advertised capability → `callNativeLLM(...)`.
   - On any error/timeout → fall through to the existing `supabase.functions.invoke("llm-caller", ...)`.
   - Streaming (`streamLLM`) stays cloud-only in v1 (bridging SSE is more work).

3. **`supabase/functions/_shared/llmCallerClient.ts`** — no change. Server-side callers (`mentor-copilot-chat`, `mentor-learning-path`, etc.) keep using cloud, because those run in edge functions where the device isn't reachable.

   Implication: to route Project Mentor to the device, the client must call the model directly through `llmClient` instead of going through `mentor-copilot-chat`. Two options:
   - **A.** Add a thin "compose messages on the client" path used only when `isInNativeApp()` — keeps server prompt/tools intact for the web.
   - **B.** Have `mentor-copilot-chat` return a `messages[]` "plan" that the client executes locally (via bridge) and then posts back for persistence.
   
   Recommend **A** for v1 (simpler); B later if we want server-defined prompts.

4. **Feature flag / allowlist**
   - Start with `feature === "project_mentor_chat"` only. Add others (`learning_path_suggestions`, mock interview turn) after we validate quality/latency.

5. **UX affordances**
   - Small "On-device" pill in `V4ProjectMentorChat` header when bridge is active.
   - Error toast on bridge timeout, then transparent cloud fallback.

## Changes in the React Native app (separate repo)

You'll add these to the file you pasted:

1. **Bridge script injected into WebView** (`injectedJavaScriptBeforeContentLoaded`):
   - Sets a UA/global marker: `window.__IS_SUDOMENTOR_NATIVE__ = true`.
   - Declares `window.__RN_LLM__` stub (real one is created by the web bundle; this is only a fallback).

2. **`onMessage` handler** parses `{ type, id, payload }`:
   - `"llm.request"` → run the local model, then `webViewRef.current.injectJavaScript(\`window.__RN_LLM__.resolve(${JSON.stringify(id)}, ${JSON.stringify(text)});true;\`)`.
   - `"llm.capabilities?"` → reply with the list of supported models/features.

3. **Local model runtime — pick one**
   - **`llama.rn`** (llama.cpp bindings for RN) — ship a GGUF (e.g. Llama 3.2 3B Instruct Q4). Best offline story, ~2GB model download on first launch.
   - **MLC LLM** — good perf on iOS/Android GPUs, more setup.
   - **Local HTTP (Ollama / LM Studio on the same LAN)** — no on-device weights, but only works over Wi‑Fi.
   
   For a phone-hosted mentor, `llama.rn` is the pragmatic default.

4. **Model lifecycle**
   - First-run downloader with progress UI (weights are big).
   - Warm the context on app start; keep a single session in memory.
   - Cap `max_tokens`, add a timeout, surface OOM as a bridge error so web falls back.

5. **Permissions / entitlements**
   - iOS: increased memory entitlement for large models on supported devices.
   - Android: `largeHeap="true"`, storage for model files.

## Rollout plan

1. Land bridge + `isInNativeApp` gating in the web app behind a flag (`localStorage.sudomentor.useOnDeviceLLM`).
2. Ship RN build with `llama.rn` + a small model (1B–3B) and the `onMessage` handler.
3. Enable for Project Mentor chat only; measure latency, quality, crash rate.
4. Expand to learning-path suggestions once stable. Keep streaming and mock interview on cloud until we bridge SSE.

## Open questions before build

- Which local runtime do you want to commit to (`llama.rn`, MLC, or LAN Ollama)?
- Target model + size (affects download UX and which surfaces are usable on-device)?
- OK to keep streaming + server-authored system prompts on cloud in v1?
