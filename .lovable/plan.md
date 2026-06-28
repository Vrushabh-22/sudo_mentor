## Why the mentor profile form stopped appearing

`MentorCopilot.buildGreeting` only shows the inline `[ACTION:profile_form:...]` card when `candidate.profile_completeness < 60`. The greeting check is the **only** place that reliably renders the form — the LLM is asked to emit the tag on subsequent turns, but it often doesn't.

For users who signed in starting yesterday, several basic fields (`first_name`, `last_name`, `headline`, `location`, `about`, `institution`, `course`, `cgpa`, `skills`) already get partially populated (Google sign-in fills name; previous saves filled some others), pushing `profile_completeness` past 60. So the form is suppressed even though `stream`, `branch`, `graduation_year`, `cgpa`, or `skills` may still be empty.

On top of that, `patch_profile` (just fixed) never recomputes `profile_completeness`, so the value stored in DB drifts from reality.

## Source of truth

Edit Profile (`CandidateProfileV4.tsx`) already calls `invokeV4({ action: 'patch_profile' })` — same path as the mentor's Quick Profile. So they share the same write path into `public.candidates`. The only mismatch is the *trigger* and the *completeness math*.

## Fix

1. **Centralize completeness in one helper** — new `src/lib/profileCompleteness.ts` exporting `computeProfileCompleteness(c)` using the field set both screens care about: `first_name, last_name, headline, about, location, stream, branch, institution, graduation_year, cgpa, skills (count>0)`. Used by both Edit Profile display and patch_profile write.

2. **patch_profile recomputes & stores `profile_completeness`** — `src/lib/candidatePortalV4Client.ts`: after merging the update, read the resulting row (or merge in-memory) and write `profile_completeness` so DB stays accurate. This means every save (Quick Profile or Edit Profile) keeps the value fresh.

3. **Mentor greeting uses missing-essentials, not completeness threshold** — `src/components/candidate/v4/MentorCopilot.tsx`:
   - Replace the `profile_completeness >= 60` check with a `missingEssentials(candidate)` list (stream, branch, graduation_year, cgpa, skills, institution).
   - If anything is missing, render the greeting with `[ACTION:profile_form:fields=<missing>]` so only the truly-missing fields are asked.
   - Add a compact "Complete your profile →" chip under the input that opens the **Edit Profile** tab (sets active tab to `profile`) when at least one essential is missing — so even after the first greeting passes, the user has a one-click path to the full editor. Uses an `onOpenProfile` callback already plumbed via `V4Shell`.

4. **Edit Profile reads completeness from the same helper** so the progress bar matches what the mentor uses to decide whether to nudge.

No DB migration, no edge function change, no UI redesign. Just three files touched plus one new shared helper.

## Verification

- Existing user with `profile_completeness=70` but missing `stream`: open Mentor → profile form card appears with only `stream` field. Submit → DB row gets `stream` plus refreshed `profile_completeness`. Reload mentor → no form, just normal greeting.
- Edit Profile shows the same percentage the mentor uses.
- Quick Profile submit + Edit Profile submit both end up writing the same columns (`stream`, `branch`, `institution`, `graduation_year`, `cgpa`, `skills_v4`, mirrored `skills`).
