# Split candidate portal onto its own Supabase project (B2C-scale)

Goal: this app (sudo-mentor) gets its own Supabase project. ATS keeps recruiter data. The two DBs talk only at the "apply to a job" boundary.

## What you need to give me
Create a new Supabase project (free or pro — pro recommended for 1L+ users so you get connection pooling, PITR, and read replicas later) and share:

1. `SUPABASE_URL` (e.g. `https://xxxx.supabase.co`)
2. `SUPABASE_ANON_KEY` (publishable — goes in `.env`)
3. `SUPABASE_SERVICE_ROLE_KEY` (stored only as a secret, never in code)
4. DB password (for one-off data migration scripts; not stored)
5. Confirm region — pick the same region as the ATS project to keep cross-project sync latency low.
6. Google OAuth client ID + secret you want to re-use (or I'll guide you to create new ones for the new project).

Also confirm:
- **Existing candidates**: migrate them now, or start fresh and let them re-sign-up with Google? (Google users migrate transparently on first login — no password reset. Email/password users need a reset email unless we export the bcrypt hashes from ATS.)
- **Existing notes / tasks / projects / learning paths / XP / streaks**: copy over, or start empty?

## Architecture after the split

```text
   Candidate browser (sudo-mentor.lovable.app)
                  |
                  v
   New Supabase project  ──────────── candidate-only data
   - auth.users (candidates only)
   - candidates, candidate_notes, candidate_project_tasks,
     candidate_projects, candidate_submissions,
     candidate_learning_paths/enrollments, candidate_xp_events,
     candidate_streaks, leaderboard_*, mentor_threads/messages
   - storage: resumes, note-covers, project-uploads
   - edge functions: candidate-portal-v4-api, mentor-*, resolve-candidate-by-email, etc.
                  |
                  | only at "apply / status change"
                  v
   sync edge function (service-role on both sides)
                  |
                  v
   ATS Supabase project (unchanged) — jobs, recruiters, pipelines
```

Recruiter app keeps working as-is. Candidate portal stops touching ATS for 99% of activity (mentor chat, notes, tasks, learning paths, leaderboard, profile, projects). Only `applications` cross the boundary.

## B2C scale decisions baked into the schema

Designed for lakhs of candidates from day one:

1. **Surrogate UUIDs everywhere** with `gen_random_uuid()` — no sequential ints (avoid hot last-page contention).
2. **Composite indexes on the read paths**, not single-column:
   - `candidate_notes (candidate_id, is_archived, is_pinned desc, updated_at desc)` — powers the sidebar query in one index scan.
   - `candidate_project_tasks (candidate_id, status, position)` — powers the kanban.
   - `candidate_xp_events (candidate_id, created_at desc)` — XP history pagination.
   - `leaderboard_snapshots (scope, period, rank)` — see point 4.
3. **Partition the high-write tables by month** (Postgres declarative partitioning):
   - `candidate_xp_events`, `mentor_messages`, `candidate_activity_log` → `PARTITION BY RANGE (created_at)`, monthly partitions auto-created by a `pg_cron` job. Keeps each partition <10M rows, vacuum cheap, queries hit one partition.
4. **Leaderboard is precomputed, not live `ORDER BY xp`**:
   - `leaderboard_snapshots(scope, period, candidate_id, xp, rank)` rebuilt every 5 min by `pg_cron` calling a `refresh_leaderboard()` function. Lakhs of candidates → one materialized scan vs. millions of live sorts.
5. **Mentor chat history**: `mentor_threads` + `mentor_messages` partitioned monthly. Latest-N reads use `(thread_id, created_at desc)` index; old months archive cheaply.
6. **JSONB for flexible fields** (`profile_extra`, `note.content`, `evaluation.payload`) with **GIN indexes only on the keys we filter on** — never blanket GIN, it bloats.
7. **RLS uses SECURITY DEFINER helpers, not subqueries** — `auth_candidate_id()` returns the candidate row id from `auth.uid()` in one cached call, so every policy is `candidate_id = auth_candidate_id()` (single index lookup) instead of joining `candidates` inside every policy. This is the difference between RLS that scales and RLS that melts.
8. **Connection management**: use Supabase's Supavisor pooler (transaction mode) for the edge functions; the browser uses PostgREST so it doesn't open Postgres connections directly. 1L concurrent users → ~200 pooled connections.
9. **No `select *` in edge functions** — every function lists exact columns so PostgREST plans tighter and we can add columns later without regression.
10. **Storage**: separate buckets per content type so we can set per-bucket size limits and CDN cache rules; resumes private with signed URLs, note-covers public with long cache.

## Migration steps (build mode, in this order)

1. **Provision** new project, save service-role key as a secret in this Lovable project.
2. **Schema migration** (one big migration file per domain so it's reviewable):
   - `00_auth_helpers.sql` — `app_role` enum, `user_roles`, `has_role()`, `auth_candidate_id()`.
   - `01_candidates.sql` — `candidates`, `tenant_memberships`, profile fields, indexes, RLS.
   - `02_notes_tasks.sql` — notes + tasks tables, GIN on `content`, kanban index.
   - `03_projects.sql` — `candidate_projects`, `candidate_submissions`, `candidate_project_evaluations`.
   - `04_learning.sql` — paths, modules, videos, enrollments, progress.
   - `05_xp_streaks_leaderboard.sql` — XP events (partitioned), streaks, leaderboard snapshots, `refresh_leaderboard()`, pg_cron job.
   - `06_mentor.sql` — threads + messages (partitioned), indexes.
   - `07_applications_mirror.sql` — local mirror of jobs + my applications (read cache from ATS).
   - `08_storage.sql` — buckets + policies.
   - Each table block follows the required order: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY`.
3. **Port edge functions** to the new project (re-deploy under new project id): `resolve-candidate-by-email`, `select-candidate-tenant`, `candidate-portal-v4-api`, `mentor-learning-path`, `mentor-*`, `apply-with-social`, `patch_profile`, `generate-note-cover-sas`.
4. **Sync edge functions** between the two projects:
   - `sync-jobs-from-ats` (cron, every 2 min, ATS → new DB): pulls open jobs into `jobs_mirror` so the Discover tab queries locally instead of hitting ATS.
   - `submit-application-to-ats` (event-driven, new DB → ATS): when candidate applies, write to ATS `applications` via service-role, store ATS application id locally for status sync.
   - `sync-application-status-from-ats` (cron, every 2 min, ATS → new DB): pulls stage/status updates so the candidate sees recruiter decisions.
5. **Data migration scripts** (run once, only if you choose to migrate):
   - `pg_dump --data-only` candidate-domain tables from ATS → `pg_restore` into new DB with column remap.
   - `auth.users` migrated via Admin API loop using exported rows; Google users carry over by email on next login.
6. **Frontend swap**:
   - Change `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) to new project values.
   - Replace any direct ATS table reads with calls to the new mirror tables or edge functions.
   - Reconfigure Google OAuth on the new project; add `https://sudo-mentor.lovable.app/**` to its redirect allow-list (this also permanently fixes the alpharecruit redirect).
7. **Smoke test**: login (Google + email), tenant pick, notes CRUD, tasks CRUD, mentor chat, apply to a job (verify it lands in ATS), leaderboard, profile share, resume upload.
8. **Cutover**: flip DNS / publish, monitor ATS load drop.

## Effort estimate
- Schema + RLS + indexes: 1 build session.
- Edge function ports + sync functions: 1 build session.
- Frontend env swap + mirror-table reads: 0.5 session.
- Data migration scripts: 0.5 session (only if you migrate existing rows).

## Open decisions before I start building
1. Migrate existing candidates + their data, or start clean?
2. Same region as ATS? (please confirm region)
3. Provide the new project's URL + anon key + service-role key when ready, plus ATS service-role key (as a secret) so the sync functions can read/write ATS.
4. Should the new project also handle Google OAuth, or do you want me to keep using the ATS-side Google client and just point its redirect to sudo-mentor? (New client is cleaner for isolation.)

Once you answer these and share the keys, I'll switch to build mode and execute steps 1–7.
