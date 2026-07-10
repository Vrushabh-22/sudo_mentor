Add an on-device streaming path to the Mentor chat so prompts are answered by the phone's LLM when the React Native shell is ready, with cloud (`mentor-copilot-chat`) as the fallback.

## Files

### 1. NEW `src/lib/uuid.ts`
Small `uuid()` shim that uses `crypto.randomUUID()` when available and otherwise builds a v4 UUID from `crypto.getRandomValues()`. Needed because `randomUUID` is secure-context only and is `undefined` in the WebView over plain http on a LAN IP.

### 2. `src/lib/nativeLLMBridge.ts` — add streaming
- Extend the top protocol comment to document `stream: true`, the batched `chunk(id, delta)` / `done(id)` callbacks, and that streaming timeout is an idle budget.
- Extend `Pending` with `timeoutMs`, `acc`, `onChunk?`.
- Add `chunk` and `done` to the `window.__RN_LLM__` global type.
- Add a `rearm(id, p)` helper that resets the idle timer on each chunk.
- Inside `install()`, add `chunk` (rearm + append + forward delta) and `done` (clear timer, resolve accumulated text) between `reject` and `capabilities`.
- Refactor `callNativeLLM` into a private `request(req, timeoutMs, onChunk?)` that sets `stream: Boolean(onChunk)` in the payload and stores `timeoutMs/acc/onChunk` in the pending entry. Re-export:
  - `callNativeLLM(req, timeoutMs=45_000)` — unchanged public signature, delegates to `request`.
  - `streamNativeLLM(req, onChunk, timeoutMs=45_000)` — new, delegates to `request` with `onChunk`.
- Leave `resolve`, `reject`, `capabilities`, `isInNativeApp`, `nativeBridgeReady`, `nativeSupportsFeature`, `onDeviceEnabled`, `LS_KEY`, and the eager `install()` call untouched.

### 3. `src/lib/llmClient.ts` — three edits
- Add `"mentor_copilot_chat"` to `NATIVE_FEATURE_ALLOWLIST`.
- Export `shouldUseNative` (add the `export` keyword).
- Add `streamNativeLLM` to the bottom re-export block from `./nativeLLMBridge`.

### 4. `src/components/candidate/v4/MentorCopilot.tsx`
- Import `uuid` from `@/lib/uuid` and `{ shouldUseNative, streamNativeLLM }` from `@/lib/llmClient`; add `const MENTOR_FEATURE = "mentor_copilot_chat"`.
- Replace all five `crypto.randomUUID()` calls with `uuid()` (in `loadHistory`, `loadOlderMessages`, `send` ×2, and the interview-recap message built in `MockInterviewOverlay`'s `onClose`).
- Rewrite `send()`: extract the existing SSE reader into a local `streamFromCloud()`, add a shared `paint(delta)` used by both branches so the typing animation is identical, and add a `resetBubble()` used before falling back. Flow:
  1. If `shouldUseNative(MENTOR_FEATURE)`, try `streamNativeLLM({ feature, messages: outbound }, paint)`.
  2. On any native error, log a warning, call `resetBubble()`, and run `streamFromCloud()`.
  3. Otherwise call `streamFromCloud()` directly.
  4. On overall failure, replace the placeholder bubble with the existing "😔 Sorry…" error message.
- If a leftover bare `return;` sits above the `if (!text.trim() ...)` guard, remove it.

## Non-goals / constraints
- No changes to `vite.config.ts`, `V4ProjectMentorChat.tsx` (its one-shot `callNativeLLM` path stays), or any edge function.
- No new UI, badges, debug output, or build stamps.
- `callNativeLLM`'s public signature and behaviour stay identical.
- Native replies bypass `mentor-copilot-chat`, so they are not persisted — accepted for now.

## Verify
`tsc --noEmit` (via `tsgo`) passes.
