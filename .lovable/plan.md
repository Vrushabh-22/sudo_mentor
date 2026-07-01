
## Goal

Collapse the Practice hub to a single **Workout** experience. Reuse the colorful pillar-card design from the current Daily Quiz, but drive it from the real admin-managed practice content (pillars → subtopics → approved items). Kill the "Could not load workout / No practice content" error state by only showing pillars that actually have approved items.

## Changes

### 1. `PracticeHub.tsx` — remove tab switcher
- Delete the `workout / quiz / paths` pill toggle.
- Header stays ("Practice · Daily reps to stay career-fit").
- Render two sections stacked:
  1. `DailyWorkout` (redesigned, see #2)
  2. `MyLearningPaths` in a collapsed "Learning Paths" section below (kept, since it's independent content).
- Remove all `DEFAULT_DOMAINS`, `start()`, `submit()`, `running`, `result`, `answers` legacy quiz state and JSX. All quiz-run flow now lives inside the workout.

### 2. `DailyWorkout.tsx` — new pillar-card landing design
Replace the current plain list with the Daily Quiz visual language, but data-driven:

**Data source**: call `practice-workout` with a new action `list_available_pillars` which returns pillars that have ≥1 approved item, with:
- `pillar_id, slug, name, icon, color_gradient`
- `available_kinds` (mcq/scenario/…)
- `item_count`
- `today_attempts` for this pillar, `daily_limit` (2 attempts/day total, same as before)

**Landing view (no workout running)**:
- Top hero card: orange→rose gradient, "Today's Career Workout · Stay match-fit. Daily reps build the score recruiters see." with total attempts left today (e.g. `2/2 LEFT TODAY`).
- Grid of pillar cards using the exact styling from the old `DEFAULT_DOMAINS` grid (rounded-2xl, `bg-gradient-to-br`, emoji, name, "N questions · 5–10 min"). Colors come from `pillar.color_gradient` stored in `practice_pillars` (fallback palette in the component if null).
- If no pillars have content → single friendly empty card ("New workouts arrive soon — your admin is loading them up"), not a red toast.
- "Why workouts?" one-liner under the grid explaining the daily habit → confidence → interview readiness angle.

**Running view (tap a pillar)**:
- Call existing `get_today` but scoped to the chosen `pillar_id` (add `pillar_id` param). Backend assembles a workout using only that pillar's approved items and subtopics.
- Keep the current per-slot MCQ / open-answer rendering, progress bar, submit → feedback → next flow.
- Finish screen keeps the trophy + XP + "Career Fitness updated" card.

### 3. `practice-workout` edge function
- Add `list_available_pillars` action: joins `practice_pillars` ↔ `practice_subtopics` ↔ `practice_items` where `status='approved'`, groups by pillar, returns non-empty pillars only, plus `today_attempts` / `daily_limit` for the caller.
- Extend `get_today` to accept optional `pillar_id`; when passed, restrict slot selection to that pillar (all 3–5 slots pulled from its subtopics, weakest-first). Existing multi-pillar behavior kept as fallback when no `pillar_id`.
- On empty content for the requested pillar, return `{ ok: true, slots: [] }` so UI shows the friendly empty state instead of a toast error.

### 4. Cleanup
- Remove Daily Quiz–only imports/UI from `PracticeHub.tsx`.
- Keep `ShareSheet` win-share reachable from the workout finish screen (port the "Share win" button that Daily Quiz had).
- No DB migration needed; `color_gradient` already exists on `practice_pillars` (used by `DailyWorkout` slot list today).

## Out of scope
- No changes to admin Practice Content screens.
- No change to XP formula or `career_fitness_daily` scoring.
- Learning Paths tab content untouched, just relocated below the workout.
