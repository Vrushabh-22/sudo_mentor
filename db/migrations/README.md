# Candidate Portal DB — migration order

Standalone SQL migrations for a fresh external Supabase project. Run them in order in your new project's SQL editor.

> Goal: isolate candidate-side load from the ATS DB. The two projects only talk at the apply / status-sync boundary.

## Apply in order

| File | Purpose | Phase |
|---|---|---|
| `0001_auth_helpers.sql` | `app_role` enum, `user_roles`, `has_role()`, `auth_candidate_id()` | 1 (foundation) |
| `0002_candidates.sql` | `candidates`, `tenants`, `tenant_memberships`, on-signup trigger | 1 (foundation) |
| `0003_notes_tasks.sql` | `candidate_notes` (Tiptap + trigram search), `candidate_project_tasks` (kanban) | 1 (foundation) |
| `0004_projects.sql` *(next)* | projects, submissions, evaluations | 2 |
| `0005_learning.sql` *(next)* | learning paths, modules, videos, enrollments, progress | 2 |
| `0006_xp_streaks_leaderboard.sql` *(next)* | XP events (partitioned), streaks, leaderboard snapshots, pg_cron | 3 |
| `0007_mentor.sql` *(next)* | mentor_threads, mentor_messages (partitioned) | 3 |
| `0008_applications_mirror.sql` *(next)* | jobs_mirror, my_applications + ATS webhook receiver | 4 (cross-DB) |
| `0009_storage.sql` *(next)* | storage buckets + policies (resumes, note-covers, project-uploads) | 4 |

## After applying phase 1

1. In the new project, copy `Project URL` and `anon (publishable) key` and update this app's `.env`:
   ```
   VITE_SUPABASE_URL=https://<new>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
   VITE_SUPABASE_PROJECT_ID=<new project ref>
   ```
2. **Authentication → URL Configuration** — Site URL = `https://sudo-mentor.lovable.app`; Redirect URLs include `https://sudo-mentor.lovable.app/**` and the Lovable preview URL.
3. **Authentication → Providers → Google** — paste your new Google OAuth client ID + secret. Copy the Supabase callback URL it shows into your Google client's "Authorized redirect URIs".
4. Restart the preview and sign in with Google. The `on_auth_user_created` trigger will create the `candidates` row automatically.

## Smoke test queries (run in SQL editor after sign-in)

```sql
select count(*) from candidates;                           -- should be 1
select * from user_roles where user_id = auth.uid();       -- should show 'candidate'
select public.auth_candidate_id();                         -- returns your candidate uuid
```

## B2C scale patterns in here

- `gen_random_uuid()` PKs — no sequence hotspots at high concurrency.
- Composite indexes match the literal queries the UI runs (notes sidebar, kanban order, leaderboard rank).
- RLS policies are one index lookup via `auth_candidate_id()` (SECURITY DEFINER) — no per-row subqueries.
- GIN only on JSONB keys / text arrays we actually filter on.
- High-write tables in phase 3 (XP events, mentor messages) are partitioned monthly with a pg_cron job to create next month's partition automatically.
- Leaderboard in phase 3 is a 5-minute materialised snapshot, not live `ORDER BY xp` — that's the difference between lakhs-scale and a meltdown.
- Phase 4 introduces a local `jobs_mirror` + `my_applications` so the Discover and Applications tabs never hit the ATS DB. ATS only receives a single write at "Apply" via webhook, and pushes status updates back via a webhook to a Supabase edge function here.
