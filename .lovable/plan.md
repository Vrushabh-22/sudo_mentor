## Root cause (verified with DB)

Aptitude has 20 approved items but the workout returns 0 slots. All 20 items were uploaded with `stream_tag` set to *topic labels* — `HCF`, `Algebra`, `Ratio`, `Average`, `Percentages`, `Profit & Loss`, `Time & Work`, `Probability`, etc. Meanwhile:

- `practice_pillars.aptitude.is_stream_aware = true`
- The signed-in candidate (`akshay.deshmukh@techademy.com`) has `stream = "CSE"`

The current JS filter in `practice-workout` keeps only items where `stream_tag == null || stream_tag == "CSE"`. None of the 20 items match either → empty pool → 0 slots → "No content for this workout yet" toast.

So this is a data-shape mismatch (Excel row was tagged with a topic name in the `StreamTag` column), not a code bug in the sense of the earlier `.or()` failure — but the workout builder should not go silent on it.

## Fix

Two small changes, no DB migration needed.

### 1. Make stream filter best-effort in `supabase/functions/practice-workout/index.ts`

Inside `getOrBuildToday`, replace the "hard drop when stream doesn't match" behaviour with:

- Fetch all approved items for the subtopic.
- If pillar is stream-aware AND candidate has a stream, split the pool into `preferred` (stream matches or is null) and `fallback` (everything else).
- Pick from `preferred` first; only if `preferred` after `usedItemIds` filter is empty, fall back to `fallback`.
- Add a `console.warn` when we had to fall back so admins can spot mis-tagged banks.

This keeps stream-awareness working when data is correctly tagged, and prevents the "silently empty" failure when it isn't.

### 2. Friendlier + more diagnostic UI in `src/components/candidate/v4/practice/DailyWorkout.tsx`

`startPillar` currently shows the same red toast for both "empty slots" and "error returned". Split it:

- If `error`: show the actual error message.
- If `!error && !slots.length`: keep the friendly toast, but also `console.warn` the response so we can diagnose next time from the browser console.

No other UI changes.

## Files touched

- `supabase/functions/practice-workout/index.ts` — best-effort stream filter + warn log
- `src/components/candidate/v4/practice/DailyWorkout.tsx` — split error vs empty toasts + console.warn

## Optional cleanup (not doing unless you confirm)

The 20 Aptitude rows have topic names sitting in `stream_tag`. Once the code fix above is in, they'll be served correctly. If you want, we can also run a one-line SQL to `UPDATE practice_items SET stream_tag = NULL WHERE stream_tag NOT IN (<real streams>)` — but that's a data change, so I'll wait for your go-ahead.
