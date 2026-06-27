## Pivot summary

Drop the tenant concept entirely — this app is now a single-tenant B2C portal with two roles: `admin` (you) and `candidate` (end user). Admin gets a separate login + dashboard to configure system settings (Azure, LLM, OAuth, etc.) and manage candidates at lakhs-of-users scale.

## Phase 0 — Unblock build (mechanical, no design impact)

`src/utils/storageUrl.ts` imports `SUPABASE_URL` which the new client doesn't export. Two options, I'll do (a):
- (a) Export `SUPABASE_URL` from `src/integrations/supabase/client.ts` (one-line export).
- Re-run `bun run build:dev` to confirm green.

## Phase 1 — Drop tenant concept

Code:
- Remove `V4TenantSwitcher` from `V4Shell` header.
- Remove `tenantId` from `CandidateUser`, `useCandidateAuth`, `invokeV4`, `TenantPickerModal`, and `pendingTenantChoices` flow.
- `useCandidateAuth.hydrate` becomes: `getSession()` → upsert/select the `candidates` row by `user_id` → set user. No more `resolve-candidate-by-email` edge function dependency for login.
- Delete `TenantPickerModal` usage and `select-candidate-tenant` references.

Schema (migration 1):
- `app_role` enum: `admin`, `candidate`.
- `user_roles(user_id, role)` + `has_role()` SECURITY DEFINER helper (standard Lovable pattern, prevents recursive RLS).
- `candidates(id, user_id unique, email citext, full_name, avatar_url, phone, headline, bio, resume_url, location, skills text[], profile_extra jsonb, xp_total, streak_days, last_active_at, created_at, updated_at)` with indexes on `email`, `last_active_at desc`, GIN on `skills`, trigram GIN on `lower(full_name)` and `email` for admin search at scale.
- `handle_new_user()` trigger on `auth.users` → inserts into `candidates` + grants `candidate` role.
- RLS: candidate sees own row; admin sees all via `has_role(auth.uid(),'admin')`.
- GRANTs per Lovable rules (no `anon`, `authenticated` + `service_role`).

## Phase 2 — Super-admin bootstrap

- Seed the super admin via an idempotent edge function `bootstrap-super-admin` invoked once: creates `auth.users` row for `akshay.deshmukh@techademy.com` with password `Akshay1234$$` (email pre-confirmed) using service role, then inserts `(user_id, 'admin')` into `user_roles`.
- Run it automatically the first time via a one-shot data insert after the migration completes (uses `supabase.auth.admin.createUser` from the edge function). Idempotent: skip if user already exists, just ensure admin role row exists.
- Add `/admin/login` and `/admin` routes. Admin login uses standard email+password (no OAuth). After login, check `has_role(auth.uid(),'admin')` via a `useIsAdmin()` hook; non-admins are redirected away.

Note on the password: storing user-supplied passwords in chat is not ideal, but since you explicitly provided it as a bootstrap credential I'll use it once via the bootstrap function and recommend you rotate it from the admin UI after first login (a "Change password" form will be included in admin settings).

## Phase 3 — Admin settings storage (Azure, LLM, etc.)

Schema (migration 2):
- `app_settings(key text primary key, value jsonb not null, updated_by uuid, updated_at timestamptz)`.
  - Single source of truth, JSON values so we can add new providers without migrations.
  - Seed keys: `azure_openai` (`{endpoint, deployment, api_version}`), `llm_default` (`{provider, model, temperature}`), `google_oauth` (`{client_id}` — secret stays in Supabase secrets), `branding` (`{name, logo_url}`).
  - **Secrets (API keys) are NOT stored here.** They go into Supabase Edge Function secrets via `add_secret`. The DB only stores non-secret config (endpoint, deployment name, model id, etc.). The admin UI's "Set/Rotate API key" buttons will trigger the `add_secret` flow.
- RLS: only `admin` can SELECT/UPDATE.
- Edge functions read settings via service role + secrets via `Deno.env.get`.

Admin UI:
- `/admin` shell with tabs: **Candidates**, **Settings → Azure / LLM / OAuth / Branding**, **Audit log** (later).
- Each setting tab is a typed form; submit → upsert into `app_settings`; secret fields show "Set" / "Update" buttons that open a secret-input flow.

## Phase 4 — Admin candidates management at scale

Goal: list/search/inspect candidates when there are lakhs (10⁵–10⁶+).

Schema additions (in migration 1):
- Composite indexes:
  - `(last_active_at desc, id)` — keyset pagination on activity.
  - `(created_at desc, id)` — keyset pagination on signup time.
  - `trgm` indexes on `lower(full_name)` and `email` for ILIKE search.
- Optional materialized view `candidate_stats_mv` (refreshed every N minutes via pg_cron) for `total_count`, `active_last_7d`, etc. — avoids a `COUNT(*)` on the hot path.

Edge function `admin-candidates-list`:
- Verifies admin via JWT.
- Accepts `{ cursor?: {last_active_at, id}, limit (max 100), q?, sort? }`.
- Returns `{ rows, nextCursor }` using **keyset pagination** (`WHERE (last_active_at, id) < (cursor.last_active_at, cursor.id) ORDER BY last_active_at DESC, id DESC LIMIT N`).
- Search uses trigram index when `q` is set.
- Counts come from the materialized view, not `COUNT(*)`.

Admin UI:
- Virtualized list (e.g. `@tanstack/react-virtual`) — never renders 1000+ DOM rows.
- Infinite query via `useInfiniteQuery` consuming the cursor.
- Server-side search box (debounced).
- Drawer for candidate detail: profile, XP, applications, notes count, suspend/reactivate.
- Bulk actions deferred until you ask.

The Supabase 1000-row default is a PostgREST limit; we sidestep it by (a) calling our edge function which sets `range` explicitly, and (b) using cursor-based pagination so any single page is small. The DB itself has no such limit.

## Phase 5 — (Out of scope for this PR, listed for next round)

- Candidate features that read settings (Mentor chat reading `llm_default`, etc.) — once Phase 3 lands, the edge functions can stop relying on env-baked defaults.
- pg_cron job to refresh `candidate_stats_mv` and to mark inactive candidates.
- Admin audit log table.

## Files I'll touch this round

Build fix:
- `src/integrations/supabase/client.ts` (export `SUPABASE_URL`).

Tenant removal:
- `src/hooks/useCandidateAuth.tsx`
- `src/lib/candidatePortalV4Client.ts`
- `src/components/candidate/v4/V4Shell.tsx`
- delete usages of `V4TenantSwitcher` and `TenantPickerModal` (keep files but unused; remove imports).

New routing:
- `src/App.tsx` — add `/admin/login` and `/admin/*`.
- `src/pages/AdminLogin.tsx`, `src/pages/AdminShell.tsx`, `src/components/admin/AdminCandidatesList.tsx`, `src/components/admin/AdminSettings*.tsx`, `src/hooks/useIsAdmin.tsx`.

Edge functions:
- `supabase/functions/bootstrap-super-admin/index.ts`
- `supabase/functions/admin-candidates-list/index.ts`
- `supabase/functions/admin-update-setting/index.ts`

Migrations:
- M1: roles + candidates + indexes + RLS + trigger.
- M2: `app_settings` table + RLS + seed default keys with empty JSON.

## What I need from you to proceed

1. **Approve the plan** so I can switch to build mode.
2. After phase 2 you'll need to (still one-time, dashboard only):
   - Auth → Providers → enable **Email** with password sign-in (it's on by default but confirm Email confirmations are OFF for the bootstrap admin to work, or I'll pre-confirm via service role).
   - Auth → URL Configuration → Site URL + redirect URLs (you already have this for Google OAuth on the candidate side).
3. Confirm you're OK with the bootstrap function pre-confirming the admin email (so you don't need an inbox round-trip).
