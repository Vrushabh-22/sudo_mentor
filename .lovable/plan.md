## Two independent fixes

### Fix 1 — "Already registered" silent-failure (ship immediately, no config)

Supabase's `signUp` silently no-ops for existing emails and returns `data.user.identities: []`. Today the UI shows "Check your inbox" — misleading. Detect and message it.

- **`src/hooks/useCandidateAuth.tsx`** — in `signUp`, after `supabase.auth.signUp`, check `data.user?.identities?.length === 0`. If so, return `{ error: null, alreadyRegistered: true, needsConfirmation: false }`.
- **`src/pages/CandidateAuth.tsx`** — if `alreadyRegistered`, skip the success card. Show a toast: *"This email is already registered. Sign in or reset your password."* Auto-switch tab to Sign in, prefill the email, focus the password field.

That alone eliminates most "no email received" reports.

### Fix 2 — Branded auth emails via Resend + Supabase Send-Email HTTPS Hook

Because this project uses external Supabase, we bypass Lovable's email scaffolder and use Supabase's native HTTPS hook pointed at our own edge function.

**Sequence:**

1. **I deploy the function first** (so you have a URL to paste in the Supabase hook dialog):
   - `supabase/functions/send-auth-email/index.ts`:
     - Standard CORS + `OPTIONS` handler.
     - Verifies the Supabase webhook signature with `standardwebhooks` (`npm:standardwebhooks@1.0.0`) using `SEND_EMAIL_HOOK_SECRET`.
     - Parses `{ user, email_data }` payload. `email_data` fields used: `token_hash`, `redirect_to`, `email_action_type`, `site_url`.
     - Builds confirmation URL: `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`.
     - Picks subject + body per `email_action_type`: `signup` → "Confirm your email", `recovery` → "Reset your password", `magiclink` → "Your sign-in link", `email_change` → "Confirm your new email", `invite` → "You're invited".
     - Simple branded HTML template — SudoMentor wordmark, gradient header (#6366f1 → #a855f7), CTA button, plain-text fallback.
     - Sends via `POST https://api.resend.com/emails` with `Authorization: Bearer ${RESEND_API_KEY}`, `from: ${AUTH_EMAIL_FROM}`, `to: [user.email]`.
     - Returns 200 on success, 4xx/5xx with JSON error and CORS headers otherwise.
   - `supabase/config.toml` — add `[functions.send-auth-email]` with `verify_jwt = false`.
   - Deploy via `supabase--deploy_edge_functions`.
   - I'll give you the function URL to paste into the Supabase hook dialog.

2. **You do (external):**
   - Verify a domain in Resend (DKIM/SPF DNS records).
   - Create a Resend API key.
   - Back in Supabase → Auth → Hooks → **switch Hook type to HTTPS**, paste the function URL, click **Generate secret**, copy the `v1,whsec_…` value.
   - Paste back to me: Resend API key, "from" address (e.g. `SudoMentor <noreply@sudomentor.com>`), signing secret.

3. **I store secrets** via `add_secret`: `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `SEND_EMAIL_HOOK_SECRET`.

4. **You enable the hook** in Supabase. All auth emails now branded and delivered via Resend.

### Simpler alternative (skip Fix 2 code, still get deliverability)
Supabase Dashboard → Project Settings → **Authentication → SMTP Settings** → paste Resend SMTP creds. Templates stay generic (edit in Auth → Email Templates by hand). Zero code, no hook, no branded HTML. Say the word if you prefer this.

## Files touched

- `src/hooks/useCandidateAuth.tsx` — detect `alreadyRegistered`
- `src/pages/CandidateAuth.tsx` — react to `alreadyRegistered`, switch tab + prefill
- `supabase/functions/send-auth-email/index.ts` — new
- `supabase/config.toml` — register function with `verify_jwt = false`

No DB migrations. Existing signup/recovery flow unaffected until you enable the hook.
