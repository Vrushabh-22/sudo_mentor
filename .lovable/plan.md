## Goal

Replace the current "Daily Quiz / Learning Paths" Practice section with **Daily Career Fitness** — a Duolingo-style 15-min daily workout across 12 admin-managed pillars, with stream-aware adaptive sequencing and a live Career Fitness Score. All pillar content is admin-curated through a new **Practice Content** menu in `/admin`.

## Phase 1 — 12 Pillars

Aptitude · Logical Reasoning · English & Vocab · Communication · Confidence & Speech · HR Interview · Technical (stream-aware) · Resume & ATS · Soft Skills & Workplace · AI Literacy & Prompting · Current Affairs · Daily Mock Interview.

Each pillar has subtopics (e.g. Aptitude → Speed Maths, Percentages…). Schema lets us add the remaining 8 pillars later without migration.

## Database (new tables)

```
practice_pillars          id, slug, name, icon, color, sort_order, enabled, is_stream_aware
practice_subtopics        id, pillar_id, slug, name, sort_order, difficulty_default
practice_prompts          id, subtopic_id, kind('mcq'|'speech'|'scenario'|'writing'|'mock'),
                          system_prompt, user_prompt_template, few_shot jsonb,
                          model_override, temperature, schema_json, version, is_active
practice_items            id, subtopic_id, prompt_id, payload jsonb (question/options/answer/rubric),
                          difficulty, stream_tag, source('admin'|'llm'),
                          status('draft'|'approved'|'archived'), quality_score, created_by
practice_daily_workout    id, candidate_id, date, slots jsonb (pillar_id + subtopic_id + item_ids + time_budget),
                          status, total_xp
practice_attempts         id, candidate_id, workout_id, pillar_id, subtopic_id, item_id,
                          answer jsonb, score, is_correct, latency_ms, ai_feedback jsonb, created_at
career_fitness_scores     candidate_id, pillar_id, score(0-100), last_updated  (PK candidate_id+pillar_id)
career_fitness_daily      candidate_id, date, overall, per_pillar jsonb, streak_day  (for trend chart)
```

All tables get `GRANT` blocks + RLS (candidate owns their rows; admin via `is_admin()`). `practice_*` content tables are admin-write / authenticated-read.

`career_fitness_daily` partitioned by month (same pattern as `llm_call_log`) for B2C scale.

## Admin — new "Practice Content" sidebar entry (`/admin`)

Added to `AdminSettings` MENU alongside LLM / Azure. Three-pane Prompt Studio:

1. **Pillars list** (left) — drag-reorder, enable/disable, edit name/icon/color.
2. **Subtopics** (middle) — per selected pillar; difficulty default, stream-aware toggle.
3. **Prompt editor** (right) — per subtopic:
   - System prompt + user template (with `{candidate_stream}`, `{difficulty}`, `{recent_topics}` vars)
   - Few-shot JSON examples
   - Output schema (so `llm-caller` can validate)
   - "Generate sample" button → calls `llm-caller` → preview rendered item
   - "Promote to bank" → inserts into `practice_items` as `source='llm'`, `status='draft'` for review
   - **Items bank** tab: list, approve/archive, manual create

Single edge function `practice-admin` handles all CRUD + sample generation through existing `llm-caller`.

## Candidate Practice tab — "Today's Career Workout"

Replaces current `PracticeHub` grid:

```
┌─ 🔥 Today's Career Workout ───────────────────┐
│ ✅ Aptitude · Percentages (3 min)             │
│ ⏳ English · Sentence Correction (2 min)      │
│ ⏳ HR · Tell me about a failure (4 min)       │
│ ⏳ AI · Prompt for summarisation (2 min)      │
│ ⏳ Technical · {stream-specific} (4 min)      │
│ ── 15 min · +60 XP · streak 🔥 7              │
└───────────────────────────────────────────────┘
```

- One-tap "Start workout" → runs slots sequentially; each slot uses the right renderer (MCQ / speech-record / scenario / writing / mock).
- Speech slots reuse `useTTSProvider` + mic capture; AI scoring via `llm-caller` with rubric in prompt.
- Per-slot XP, per-pillar score delta animated.
- End screen → updated **Career Fitness Score** dial + per-pillar bars + share card (reuses `ShareSheet`).

Secondary tabs inside Practice: `Workout` (default) · `Pillars` (drill into any pillar for extra practice) · `Learning Paths` (kept as-is).

## Stream-aware adaptive selection

Server-side `pick_daily_workout(candidate_id)` edge function:
1. Read `career_fitness_scores` → pick 2 weakest pillars + 3 rotating staples (always include Communication or HR daily).
2. For each pillar pick a subtopic the candidate hasn't seen in last N days.
3. For `is_stream_aware` pillars (Technical), filter items by `candidates.stream` / `branch`.
4. Select `approved` items first; if bank thin, call `llm-caller` with the subtopic's prompt to generate fresh (cached 24h via `llm_cache`).
5. Persist as `practice_daily_workout` row → returned to client.

## Career Fitness Score

After each attempt:
- Pillar score = EMA(previous, latest_normalised, alpha=0.2).
- Overall = weighted avg (Communication & Technical weight 1.2; others 1.0) + consistency bonus (streak_days capped at 30).
- Snapshot daily into `career_fitness_daily` for trend chart on Home.

`V4Home.tsx` gets a new "Career Fitness" card showing overall % + 7-day sparkline.

## Edge functions (new)

- `practice-admin` — pillar/subtopic/prompt/item CRUD + LLM sample generation (admin-only).
- `practice-workout` — actions: `get_today`, `start_slot`, `submit_attempt`, `finish_workout`. All AI calls go through existing `llm-caller` (no duplicate LLM code).
- Existing `mock-interview` reused for the Mock Interview pillar slot.

## Files touched / added

```
supabase/migrations/<new>.sql                       (schema above)
supabase/functions/practice-admin/index.ts
supabase/functions/practice-workout/index.ts
src/components/admin/PracticeContentSettings.tsx    (added to AdminSettings MENU)
src/components/admin/practice/PillarsPane.tsx
src/components/admin/practice/SubtopicsPane.tsx
src/components/admin/practice/PromptStudio.tsx
src/components/admin/practice/ItemsBank.tsx
src/components/candidate/v4/practice/DailyWorkout.tsx
src/components/candidate/v4/practice/SlotRunner.tsx     (MCQ/Speech/Scenario/Writing/Mock renderers)
src/components/candidate/v4/practice/FitnessScoreCard.tsx
src/components/candidate/v4/PracticeHub.tsx             (refactored: Workout | Pillars | Paths tabs)
src/components/candidate/v4/V4Home.tsx                  (Fitness card)
src/lib/practiceClient.ts                               (invoke wrappers)
```

Old `start_practice` / `submit_practice` actions on `candidatePortalV4Client` stay temporarily so legacy quiz still works, then removed once Workout flow is live.

## Out of scope (phase 1.5+)

- Weekly unlocks (Coding Contest, Hackathon)
- Monthly company challenges (Crack TCS / Infosys)
- Pillars 13–20 (Emotional Intelligence, Digital Skills, etc.) — schema already supports them.

## Verification

1. Admin → Practice Content → create pillar "Aptitude" → subtopic "Percentages" → write prompt → Generate sample → Approve item.
2. Candidate /portal → Practice tab → "Today's Career Workout" lists 5 slots, Technical slot matches candidate stream.
3. Complete workout → Fitness Score updates, snapshot row appears in `career_fitness_daily`, Home shows updated %.
4. Re-open next day → fresh subtopics, weakest pillar prioritised.
