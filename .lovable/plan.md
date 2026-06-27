# Port Mentor Suite from lovable-hiring-hub-02

Clone the full mentor functionality (chat with memory, on-the-fly Learning Paths, interview bot) into this project. **All AI calls route through the central `llm-caller` edge function** — no direct provider calls anywhere.

## What you get

- **AlphaMentor chat**: warm, streaming, with long-term memory, mode detection (mock interview / warmup / debrief / resume / emotional / coding / general), weakness radar, streak tracking, profile-completion nudges, learning-path tag injection.
- **Learning Paths on the fly**: when the chat emits `[ACTION:learning_path:...]`, the UI calls `mentor-learning-path` which either reuses an existing curated path or generates a new YouTube-curated path with modules + lessons.
- **Mock Interview overlay**: voice/camera bot driven by `mentor-copilot-chat` (ephemeral mode) and `mock-interview` for evaluation.

## DB migration (already approved & applied)

Added candidate profile fields (first_name, last_name, stream, branch, institution, graduation_year, cgpa, skills_v4, profile_completeness) and these tables: `candidate_mentor_sessions`, `candidate_mentor_messages`, `candidate_mentor_memory`, `learning_paths_catalog`, `candidate_lp_enrollments`, `candidate_lp_video_progress`, `candidate_xp_events`. All with RLS scoped to `auth.uid()` candidate and admin override.

## Edge functions to create

### 1. `supabase/functions/mentor-copilot-chat/index.ts`
Streaming chat. Resolves candidate via JWT → loads session/memory → builds the AlphaMentor system prompt (mode-aware, with student context + cross-session memory + opening rules + LP tag rules) → forwards `[system, ...history]` to `llm-caller` in `stream` mode (passing the user's Authorization header) → pipes SSE through to the browser → captures the accumulated text and persists the assistant message. Adds deterministic LP tag fallback when the model forgets. Supports actions: `history`, `older`, `memory`, default chat, and `ephemeral: true` for the interview overlay.

### 2. `supabase/functions/mentor-learning-path/index.ts`
Actions: `find_or_create` (slug match → LLM-judge match → YouTube curation + LLM module assembly), `list_my_paths`, `get_path`, `mark_progress` (awards XP via `candidate_xp_events` + bumps `xp_total`), `rate`. LLM judge and curation both call `llm-caller` in `json` mode (re-engineered from tool-calling to JSON output so they slot into our unified caller). YouTube fetch reads `YOUTUBE_API_KEY` from secrets; if missing returns a clear error.

### 3. `supabase/functions/mock-interview/index.ts`
Modes: `next-question` (per-turn JSON), `evaluate` (final scored feedback). Both call `llm-caller` in `json` mode. Used by mock-interview overlay variants and the PracticeHub for non-AlphaMentor interview flows.

## Wiring (frontend)

`MentorCopilot.tsx`, `MockInterviewOverlay.tsx`, `LearningPathView.tsx`, `MyLearningPaths.tsx` already call these endpoints. No frontend changes needed once functions are deployed — the existing `fetch` / `supabase.functions.invoke` calls just start working.

## Secrets

- `LLM_KEYS_ENC_SECRET`, `LOVABLE_API_KEY`, `SUPABASE_*` — already configured.
- `YOUTUBE_API_KEY` — required for fresh LP generation. Will prompt you to add this when implementing.

## Technical notes (for review)

- mentor-copilot-chat forwards the user JWT to llm-caller so llm-caller can identify the calling user and log usage against them.
- The llm-caller currently runs OpenAI-compatible streaming (works for OpenAI/Groq/Lovable/Azure); Gemini streaming SSE differs and would need a small adapter tweak if you switch to Gemini as the active provider.
- LP catalog is shared across all candidates — first user to ask for "SQL" pays for curation, everyone else reuses it (massive cost savings at B2C scale).
- LP video progress upserts on `(candidate_id, path_id, video_id)` for idempotent autosaves.

After approving the plan I'll build the three edge functions, redeploy, and verify the mentor chat end-to-end.
