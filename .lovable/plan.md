# Wire Mentor Suite to llm-caller — port prompts from lovable-hiring-hub-02

The reference project (`@lovable-hiring-hub-02`) already has the three edge functions with battle-tested prompts and logic:
- `supabase/functions/mentor-copilot-chat/`
- `supabase/functions/mentor-learning-path/`
- `supabase/functions/mock-interview/`

I will port them as the source of truth. Prompts, mode-detection rules, LP-tag grammar, memory extraction, YouTube curation logic, interview scoring rubric — all copied verbatim from there. Only the AI provider call sites are rewritten to go through our central `llm-caller`.

## Step 1 — Read source functions

For each of the three folders above I'll:
1. `cross_project--read_project_file` on `index.ts` (and any helpers in the function's folder, plus referenced files in `supabase/functions/_shared/` and `supabase/functions/shared/`).
2. Copy all prompts (system prompts, judge prompts, evaluator prompts), helpers (mode detection, memory builders, LP slug/normalize, YouTube fetch), and DB query shapes verbatim.

## Step 2 — Rewrite AI calls only

In the source those functions call OpenAI/Groq/etc. directly. In our port every model call becomes:

- non-stream chat / JSON → `fetch(${SUPABASE_URL}/functions/v1/llm-caller, { body: { feature, mode:"chat"|"json", messages, ... } })` forwarding the user's `Authorization` header.
- streaming chat → same endpoint with `mode:"stream"`, then pipe the SSE bytes straight to the browser.

A tiny `_shared/llmCaller.ts` helper wraps these three call shapes. No prompt text lives in the helper — prompts stay in the function files exactly as copied from the source.

## Step 3 — Reconcile schema differences

Source project is multi-tenant (`tenant_id`, separate `candidate_mentor_*` schema variants). Our port is single-tenant B2C with tables already provisioned (`candidate_mentor_sessions/messages/memory`, `learning_paths_catalog`, `candidate_lp_enrollments`, `candidate_lp_video_progress`, `candidate_xp_events`, `candidates`). I'll:
- Strip `tenant_id` filters.
- Map any column name drift (e.g. `candidate_id` → our schema) inline during the port — no migrations needed, the tables already match the original shapes used by the UI.
- Keep RLS-safe service-role admin client for writes, user-client for auth resolution.

## Step 4 — Action contracts already match the UI

The UI calls (`history`, `older`, `memory`, default streaming chat with `ephemeral` for mock-interview; `find_or_create`, `list_my_paths`, `get_path`, `mark_progress`, `rate`; `next-question`, `evaluate`) line up with the source functions' contracts. No frontend changes.

## Step 5 — Secrets

- Required and already configured: `LLM_KEYS_ENC_SECRET`, `LOVABLE_API_KEY`, `SUPABASE_*`.
- `YOUTUBE_API_KEY` — source uses it for LP curation. I'll request it via `add_secret` only when we hit the curation path; until then `find_or_create` returns `youtube_key_missing` with a clear message.
- Any other source-only env vars (OpenAI/Groq keys, Azure config) are dropped — we don't need them because all AI traffic goes through `llm-caller`.

## Step 6 — Verify

After deploy:
1. Open MentorCopilot → confirm SSE stream + `llm_call_log` row with `feature='mentor_chat'`.
2. `MyLearningPaths` empty-state load → 200.
3. Trigger `mock-interview evaluate` with a stub transcript → JSON shape matches the overlay's parser.
4. Tail edge logs for each function.

## Out of scope for this pass

- Coding copilot, multi-chat, assessment generators, and other AI features from the source project. Only Mentor / LP / Mock-Interview, per your direction.
