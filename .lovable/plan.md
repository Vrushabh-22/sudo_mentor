
## Goal

Stand up a standalone app that hosts only the **candidate portal V4 UI** (and the candidate `/auth` login flow it depends on), pointed at the existing ATS Supabase instance. No backend changes — same DB, same edge functions, same RLS.

## Stack reset

The current scaffold is TanStack Start; the source uses Vite + React Router DOM. To keep behavior identical and avoid rewriting every component's routing/auth code, the project will be re-scaffolded:

- Remove TanStack Start shell (`src/routes/`, `src/router.tsx`, `src/start.ts`, `src/server.ts`, `src/routeTree.gen.ts`, TanStack-specific Vite config).
- Add `react-router-dom`, `@supabase/supabase-js`, `@tanstack/react-query` (used by V4 components), shadcn deps already present.
- New entry: `src/main.tsx` → `<BrowserRouter>` → `<App />`.
- New `src/App.tsx` with just two top-level routes:
  - `/` → `CandidatePortalV4`
  - `/auth` → candidate auth page (email/OTP, role=candidate)
  - `*` → redirect to `/`
- Keep Tailwind + shadcn config from the source project (copy `index.css`, `tailwind.config`, `components.json`).

Path choice per your answer: portal mounts at `/`. Internal references to `/candidate-portal-v4` (PWA manifest, fullscreen-board `window.open`, post-login redirects in JoinAuthCard) are rewritten to `/`. SSO/HExP partner links and the public apply flow are out of scope for this project.

## Files to port from `lovable-hiring-hub-02`

Copied 1:1 unless noted:

- `src/pages/CandidatePortalV4.tsx` → `src/pages/CandidatePortalV4.tsx` (rewrite the `<Navigate to="/auth?...redirect=/candidate-portal-v4">` to `redirect=/`)
- `src/pages/Auth*.tsx` — the candidate-login variant only (identify which Auth page handles `role=candidate`; port that one)
- `src/components/candidate/v4/**` (entire folder — V4Shell, V4Home, V4JobsTab, MyBoardCanvas, chat/, interview/, myboard/, notes/, projects-cluster/, share/, etc.)
- `src/components/candidate/TenantPickerModal.tsx`
- `src/hooks/useCandidateAuth.ts`, `useCandidatePWAManifest.ts`, and any other hooks transitively imported
- `src/lib/candidatePortalV4Client.ts` and any utils it pulls in
- `src/integrations/supabase/client.ts` + `types.ts`
- `src/components/ui/**` (shadcn primitives used by V4)
- `src/contexts/**`, `src/constants/**`, `src/config/**`, `src/types/**`, `src/utils/**` — only the modules transitively reached from the V4 tree (pruned, not bulk-copied)
- `src/assets/**` — only assets V4 references
- `public/candidate-manifest.webmanifest` (update `start_url`/`scope` to `/`)

I'll do the port by following the import graph from `CandidatePortalV4.tsx` and the chosen Auth page, copying each transitively referenced file and pruning everything else. Anything unreachable from those two entry points stays out.

## Supabase wiring

- Reuse the ATS Supabase project. The publishable (anon) key is safe in code, but to keep environments switchable I'll read from `.env`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID` (used by some helpers)
- `src/integrations/supabase/client.ts` uses these envs. No Lovable Cloud enabled on this project.
- The edge function `candidate-portal-v4-api` is called via `supabase.functions.invoke(...)` against the ATS project — works as-is since it's the same Supabase URL.
- **You provide** the three env values (from the ATS project's Supabase settings). I'll add an `.env.example` documenting them; once you paste the values into `.env` (or I store them via project env), the app boots against the live ATS DB.

## Out of scope

- HExP SSO routes (`/sso/hexp`, `/sso/hexp-quick`)
- Public apply pages (`/apply/*`)
- Recruiter / officer / admin dashboards
- Any DB migrations, RLS changes, or edge function changes
- V1/V2/V5 candidate portals

## Verification

1. `bun install` clean, dev server boots.
2. Open `/` → redirects to `/auth` (no session).
3. Sign in with a candidate test account → tenant picker if multi-tenant → V4 shell loads with bootstrap data from `candidate-portal-v4-api`.
4. Smoke-test each V4 tab (Home, Jobs, MyBoard, Projects, Practice, Learning, Leaderboard, Profile) — confirm they render and fetch the same data as the source app.
5. Fullscreen board (`/?fullscreenBoard=1`) opens.
6. PWA manifest serves and matches the new scope.

## Risks / things to confirm during build

- Some V4 components may import from recruiter/officer modules indirectly; I'll cut those imports or stub them where they're cosmetic.
- The candidate `/auth` page in the source may share code with other roles; I'll port a candidate-only slice rather than the full multi-role auth page.
- CORS on the ATS Supabase project must allow this new project's preview/published origin. If sign-in fails with a CORS error after deploy, you'll need to add the new origin to the ATS Supabase URL allowlist — I can't do that from here.
