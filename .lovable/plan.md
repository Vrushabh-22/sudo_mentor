## Goal

Skip email verification entirely for now. New users can sign up and are immediately signed in. Add a lightweight client-side rate limit on the signup form so the endpoint isn't spammed from one device.

Email hook / Resend work stays in place but dormant — we just stop relying on the confirmation email.

## Steps

### 1. Supabase Auth setting (manual, one click)
You toggle **Authentication → Sign In / Providers → Email → "Confirm email"** to **OFF** in the Supabase dashboard. Without this, `signUp` still returns a user with no session and no email gets delivered. I can't flip this from code — it lives in Supabase project settings.

I'll surface a `presentation-link` to the auth providers page in the reply.

### 2. `src/hooks/useCandidateAuth.tsx`
- After `supabase.auth.signUp` succeeds:
  - If `data.session` exists → user is signed in immediately. Toast "Welcome!" and return `{ error: null, needsConfirmation: false }`.
  - If `data.user?.identities?.length === 0` → keep the existing `alreadyRegistered: true` branch.
  - Otherwise (confirmation still required because dashboard toggle not flipped yet) → fall back to calling `signInWithPassword` right after signup so the user lands logged in even before you toggle the setting. If that sign-in errors with "Email not confirmed", return `needsConfirmation: true` so the UI can still show a friendly message.
- Remove nothing else; `resetPassword` stays.

### 3. `src/pages/CandidateAuth.tsx`
- Drop the "Check your inbox" success card path from the happy flow — on successful signup just let the auth state change route the user into the app.
- Keep the `alreadyRegistered` toast + tab switch behavior added earlier.
- Add local rate limiting on the signup submit:
  - Store attempts in `localStorage` under `sudomentor.signup.attempts` as `{ timestamps: number[] }`.
  - Rule: max **3 signup attempts per 10 minutes** per browser. On the 4th within window, block submit, show toast "Too many sign-up attempts. Try again in N minutes.", and disable the submit button with a countdown until the oldest attempt ages out.
  - Only count attempts that actually hit `supabase.auth.signUp` (not client-side validation failures).
  - Same guard, smaller window, on the "Forgot password" trigger if it's on this page — 3 per 15 min — to avoid recovery-email spam.

### 4. Nothing to change
- `supabase/functions/send-auth-email/index.ts` stays (unused until you enable the hook).
- `ResetPassword.tsx` / `ForgotPassword.tsx` unchanged.
- No DB migration.

## Technical notes

- Client-side rate limiting is advisory only — anyone can clear localStorage. It's here to stop accidental spam and bot form fills from a single browser, not to replace server-side protection. If you later want real protection, we'd add a Supabase edge function that gates signups by IP.
- Auto-login-after-signup fallback keeps the UX working whether or not you've flipped the "Confirm email" toggle yet, so we can ship the code first and you can flip the setting whenever.

## Files touched

- `src/hooks/useCandidateAuth.tsx` — auto-login after signup, keep `alreadyRegistered`
- `src/pages/CandidateAuth.tsx` — remove "check inbox" card, add localStorage rate limit
