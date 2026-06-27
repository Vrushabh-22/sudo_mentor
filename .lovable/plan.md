# Enable Google Sign-In for Candidates — End to End

The auth logs confirm the current error: `400: Unsupported provider: provider is not enabled`. The frontend code is already calling `signInWithOAuth({ provider: 'google' })` correctly — what's missing is the configuration on Google Cloud and Supabase. This is a configuration walkthrough, not a code change.

## Step 1 — Create Google OAuth Client (Google Cloud Console)

1. Open https://console.cloud.google.com/ → create/select a project (e.g. "Sudo Mentor").
2. **APIs & Services → OAuth consent screen**
   - User type: External
   - App name: Sudo Mentor
   - Support email: your email
   - Authorized domains: `supabase.co`, `lovable.app`, and your custom domain if any
   - Scopes: `openid`, `userinfo.email`, `userinfo.profile`
   - Add yourself as a Test user (until you publish the app)
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: Sudo Mentor Web
   - **Authorized JavaScript origins:**
     - `https://sudo-mentor.lovable.app`
     - `https://id-preview--6398ffbe-d467-4ccf-bcfe-b68f41371f32.lovable.app`
     - `https://6398ffbe-d467-4ccf-bcfe-b68f41371f32.lovableproject.com`
     - `http://localhost:8080` (optional, local dev)
   - **Authorized redirect URIs (exact, single value required by Supabase):**
     - `https://nnfaawrtzvzyqvpgvcxu.supabase.co/auth/v1/callback`
4. Save → copy the **Client ID** and **Client Secret**.

## Step 2 — Enable Google Provider in Supabase

1. Open **Authentication → Providers → Google** in the Supabase dashboard for project `nnfaawrtzvzyqvpgvcxu`.
2. Toggle **Enable Sign in with Google** ON.
3. Paste the **Client ID** and **Client Secret** from Step 1.
4. Leave "Skip nonce check" OFF.
5. Save.

## Step 3 — Set Site URL & Redirect Allow-list (Supabase)

**Authentication → URL Configuration:**
- **Site URL:** `https://sudo-mentor.lovable.app`
- **Redirect URLs (add each):**
  - `https://sudo-mentor.lovable.app/**`
  - `https://id-preview--6398ffbe-d467-4ccf-bcfe-b68f41371f32.lovable.app/**`
  - `https://6398ffbe-d467-4ccf-bcfe-b68f41371f32.lovableproject.com/**`
  - `http://localhost:8080/**`

This is what made past logins bounce to `alpharecrewt.ai` — Supabase falls back to the Site URL when the `redirectTo` isn't whitelisted.

## Step 4 — Verify the Existing Frontend Flow (no code change expected)

`src/pages/CandidateAuth.tsx` already calls:
```ts
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}/auth` }
})
```
and `handle_new_user` trigger auto-creates the `candidates` row + `candidate` role on first sign-in. No code edits needed unless verification surfaces a bug.

## Step 5 — Test End-to-End

1. Open `https://sudo-mentor.lovable.app/auth` → click **Continue with Google**.
2. Confirm Google consent screen shows "Sudo Mentor".
3. After consent, land back on `/auth` → auto-redirect to `/portal`.
4. Verify in Supabase **Authentication → Users** a new row appears, and `public.candidates` has the matching profile.

## What I need from you

Just confirm once Steps 1–3 are done (or share any error you see) and I'll run the end-to-end verification. No secrets need to be pasted into this chat — Client ID/Secret live only inside the Supabase dashboard.

<presentation-actions>
<presentation-link href="https://supabase.com/dashboard/project/nnfaawrtzvzyqvpgvcxu/auth/providers">Supabase Auth Providers</presentation-link>
<presentation-link href="https://supabase.com/dashboard/project/nnfaawrtzvzyqvpgvcxu/auth/url-configuration">Supabase URL Configuration</presentation-link>
<presentation-link href="https://console.cloud.google.com/apis/credentials">Google Cloud Credentials</presentation-link>
</presentation-actions>
