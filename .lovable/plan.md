## Problem

Clicking the **Aptitude** workout tile shows "No content for this workout yet", even though the pillar has 20 approved items.

Root cause found in `supabase/functions/practice-workout/index.ts`:

```ts
if (p.is_stream_aware && cand.stream)
  itemsQ = itemsQ.or(`stream_tag.is.null,stream_tag.eq.${cand.stream}`);
```

But `Aptitude` has `is_stream_aware = true`, and if `cand.stream` is set, all approved items were uploaded with `stream_tag = null` (via Excel default). The OR filter still returns them — so that's not the miss. The actual issue: when the candidate's `stream` is set, the `.or(...)` string is fine, but when only one subtopic ("Quantitative") holds the 20 items and the loop iterates WORKOUT_SIZE=5 times over the same pillar, the second-through-fifth iterations exhaust items (only 20 unique, but we mark `usedItemIds`) — that still gives ≥1 slot. So why zero?

The failing case is subtler: `usedSubIds` is populated after the first successful slot, and the pillar has **only one subtopic**. Line 199 filters `subtopics` to those not yet used → empty array → `remaining.length || subtopics.length` picks the full list again, so `sub` is fine. Items pool then filters out `usedItemIds` — 19 remain → still ok.

The real blocker: the `.or()` PostgREST filter breaks when `cand.stream` contains characters PostgREST treats specially (commas, spaces) or when the OR string is unquoted for a text value. For streams like `"Computer Science"` the space aborts the filter and Supabase returns an error → items query returns `null` → `pool` is empty → slot skipped 5 times → 0 slots → empty state.

## Fix

In `supabase/functions/practice-workout/index.ts` inside `getOrBuildToday`:

1. Replace the fragile `.or(...)` chain with an explicit `.in("stream_tag", [null, cand.stream])`-equivalent using two queries or a properly-quoted `.or()` value.
2. When `cand.stream` is missing/blank, do **not** apply the stream filter at all (just return items regardless of `stream_tag`).
3. Safer: fetch items with the base filter, then filter in JS by `stream_tag === null || stream_tag === cand.stream`.

Also add a small `console.error` when the items query returns an error so this class of bug is visible in edge logs next time.

No DB changes, no UI changes.

## Files touched

- `supabase/functions/practice-workout/index.ts` — swap the stream filter for a JS-side filter and log errors from the items query.
