## Goal

Add a full email + password auth flow alongside the existing social logins on `/auth`. Currently the screen shows only Google / GitHub / LinkedIn + a sign-in-only email form (no way to register).

## Changes

### 1. `src/pages/CandidateAuth.tsx` — tabbed Sign in / Sign up UI
- Replace the single email form with a two-tab layout (`Sign in` / `Sign up`) using existing shadcn `Tabs`.
- **Sign in tab**: existing email + password form + a new "Forgot password?" link.
- **Sign up tab**: email + password + confirm-password fields. On submit call `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth` } })`. Show a "Check your inbox to confirm your email" success state — do NOT redirect to portal (email confirmation required).
- Client-side validation with `zod`: valid email, password ≥ 8 chars, confirm matches.
- Keep the vapor gradient brand panel and social login buttons unchanged.

### 2. `src/hooks/useCandidateAuth.tsx` — add `signUp` + `resetPassword`
- Add `signUp(email, password)` wrapping `supabase.auth.signUp` with `emailRedirectTo: ${origin}/auth`.
- Add `resetPassword(email)` wrapping `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${origin}/reset-password })`.
- Expose both via context. Existing `signIn` / `signOut` unchanged.

### 3. New page `src/pages/ForgotPassword.tsx`
- Simple form: email → `resetPassword` → success message ("If an account exists, we've sent a reset link").
- Same brand-panel layout as `CandidateAuth` (reuse styling).

### 4. New page `src/pages/ResetPassword.tsx` (REQUIRED per Supabase recovery flow)
- Public route. On mount, verify a recovery session is active (Supabase auto-signs in the user when they land from the reset email link with `type=recovery` in the URL hash).
- Form: new password + confirm → `supabase.auth.updateUser({ password })` → redirect to `/portal` on success.
- If no recovery session detected, show "Invalid or expired reset link" with a link back to `/auth`.

### 5. `src/App.tsx` — register the two new routes
Add inside the candidate `<Routes>`:
- `/forgot-password` → `ForgotPassword`
- `/reset-password` → `ResetPassword`

### 6. Trigger sanity
The existing `handle_new_user()` DB trigger auto-creates a `candidates` row + assigns `candidate` role on every new `auth.users` insert. This already covers email signups — no DB migration needed.

## Notes for the user

- **Email confirmation is required** — new signups won't be able to log in until they click the link Supabase emails them. Supabase's default (unbranded) auth email will be used unless you later ask to scaffold custom auth email templates.
- Make sure **"Confirm email"** is enabled in Supabase Auth settings (it's on by default). If you'd rather auto-sign-in without confirmation, say so and I'll flip the flow.
- No new secrets required. No DB schema changes.

## Technical details

- Validation via `zod` (already a project dep — used elsewhere).
- Password min length 8; no complexity rules (can add later if you want).
- `/reset-password` must be a public route (not gated) since Supabase drops the user there directly from the email link.
- The recovery-session check on `/reset-password` uses `supabase.auth.onAuthStateChange` listening for the `PASSWORD_RECOVERY` event, plus a `getSession` fallback.
