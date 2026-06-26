# Fix: Google login redirects to alparecruit.ai instead of this app

## Root cause

This project's Supabase client points at the shared ATS Supabase instance (the same one `alparecruit.ai` uses). When you click "Continue with Google", our code does pass `redirectTo: ${window.location.origin}/` — but Supabase only honors a `redirectTo` value that matches an entry in that project's **Redirect URLs allow-list**. If the URL isn't whitelisted, Supabase silently falls back to the project's **Site URL**, which is set to `https://alparecruit.ai`. That's why you land there after Google sign-in.

This is an Auth configuration issue on the shared ATS Supabase project, not a code bug in this new portal — no code change in this repo can override the allow-list.

## What needs to happen

In the ATS Supabase project → **Authentication → URL Configuration**, add this app's origins to **Redirect URLs**:

- `https://id-preview--6398ffbe-d467-4ccf-bcfe-b68f41371f32.lovable.app/**` (Lovable preview)
- `https://sudo-mentor.lovable.app/**` (published)
- Any custom domain you'll point at this portal later
- `http://localhost:8080/**` (local dev, optional)

Leave the **Site URL** as-is (`https://alparecruit.ai`) so the existing recruiter app keeps working — the allow-list entries above let Supabase honor our explicit `redirectTo` for candidate-portal sign-ins from this new origin.

Same step applies to GitHub and LinkedIn (Azure) providers — they all use the same allow-list.

## Code-side check (no changes expected)

After you update the allow-list, I'll verify in `src/pages/CandidateAuth.tsx` that:

- `signInWithOAuth` uses `redirectTo: ${window.location.origin}/` (already does).
- The `/` route correctly picks up the Supabase session, runs the candidate resolve edge function, and lands on the V4 portal.

If after whitelisting the redirect still fails, the next likely culprit is the Google Cloud OAuth client's **Authorized redirect URIs** — those must include the Supabase callback `https://<your-supabase-project>.supabase.co/auth/v1/callback`. That's almost certainly already set (recruiter login uses it), so no action expected there.

## Deliverable

This plan is configuration-only — there is nothing to build in code. Approving the plan just confirms you've understood the fix; once you add the redirect URLs to the ATS Supabase project, Google login from this portal will land back on `/` here instead of `alparecruit.ai`.
