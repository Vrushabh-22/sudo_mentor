## Goal
Add an **Azure Blob Storage** configuration section to `/admin` → Settings so the super admin can store a single Azure account connection string plus per-purpose container names (starting with `resume_upload`, extensible later for note covers, project artifacts, interview audio, etc.). Persist in a dedicated table, expose via a single shared edge-function helper with **in-memory server-side caching** so high-traffic edge functions (resume upload SAS, note cover SAS, etc.) don't hit the DB on every request.

---

## 1. Database

New table `public.azure_storage_settings` (single-row config + child container map). Two-table design keeps connection string encrypted in one place and lets us add containers without schema changes.

```text
azure_storage_accounts
  id, label, account_name, connection_string_ciphertext, connection_string_iv,
  is_active (only one true), enabled, created_at, updated_at
azure_storage_containers
  id, account_id (fk), purpose (unique, e.g. 'resume_upload'),
  container_name, public_read (bool), enabled, created_at, updated_at
```

- Encrypt `connection_string` using existing `LLM_KEYS_ENC_SECRET` (same AES-GCM helper as `llm_api_keys` — reuse `supabase/functions/_shared/llmCrypto.ts`, rename helper or generalize).
- GRANTs: `authenticated` no access; `service_role` full. RLS: only `is_admin()` can SELECT/INSERT/UPDATE/DELETE from the client (admin UI calls edge functions, but RLS still enforced for safety).
- Seed one row: `purpose='resume_upload'` placeholder (no container_name until admin configures).

## 2. Edge function: `admin-azure-storage`
CRUD for admin UI (mirrors `admin-llm-keys` pattern):
- `set_account` — upsert account, encrypt connection string, mark active.
- `list` — return account (with `connection_last4` only, never the secret) + all containers.
- `upsert_container` — `{ purpose, container_name, public_read }`.
- `delete_container` — by id.
- `test_connection` — issues a lightweight Azure REST call (`GET {account}.blob.core.windows.net/?comp=list`) to verify.

Guarded by `is_admin()` check on the caller's JWT.

## 3. Shared cache helper: `_shared/azureStorage.ts`
Single module used by every function that needs Azure (resume upload SAS, note cover SAS, future ones).

```text
getAzureContainer(purpose: string) -> { accountName, accountKey, containerName, publicHost }
```

- **Module-scoped Map cache** with TTL (60 s default) keyed by `purpose`.
- On miss: one query joining `azure_storage_accounts` + `azure_storage_containers`, decrypt connection string, parse `AccountName` / `AccountKey` / `EndpointSuffix`, store in cache.
- Exposes `invalidateAzureCache()` called by `admin-azure-storage` after any write (via cross-function in-process invalidation is not possible across isolates, so cache TTL of 60 s is the eventual-consistency bound; document this).
- Exposes `generateBlobSasUrl({ purpose, blobName, contentType, expiresInMinutes })` so call sites are one-liners and SAS signing logic isn't duplicated.

## 4. Rewire existing function
`generate-note-cover-sas` (already referenced by `notes/uploadNoteCover.ts`) — if/when implemented, must go through `generateBlobSasUrl({ purpose: 'note_cover', ... })`. For now we only need the resume flow live; note cover stays untouched but follows the same pattern when added.

New function `generate-resume-upload-sas` (thin wrapper) so candidates can upload resumes directly to Azure with a short-lived SAS, called from `CandidateResumeCard.tsx`. Out of scope of this plan if you'd rather just deliver the admin config first — flag below.

## 5. Admin UI — `AdminSettings.tsx`
New card **"Azure Blob Storage"** above Google OAuth:
- Connection string input (password field, shows `••••<last4>` once saved).
- "Test connection" button (calls `test_connection`).
- Containers table: rows of `{purpose, container_name, public_read, enabled, actions}`.
- "Add container" dialog with a dropdown of known purposes (`resume_upload`, `note_cover`, `project_artifact`, `interview_audio`, `profile_avatar`) + free-text fallback, and a `container_name` input.
- Save / delete buttons wired to `admin-azure-storage`.

## 6. Scale notes
- Cache: 60 s TTL, per edge-function isolate. Worst case at 100 k concurrent users = a handful of DB hits per isolate per minute, not per request.
- Connection string never returned to the client; only `last4` for display.
- Container settings table small (<20 rows), single indexed lookup on `purpose`.

---

## Open questions before I build

1. **Scope:** build only admin config + storage table + shared helper now, and wire the actual resume upload (candidate side) in a follow-up — or include `generate-resume-upload-sas` and update `CandidateResumeCard.tsx` in this same change?
2. **Multiple accounts:** do you ever want to point different purposes at different Azure accounts (e.g. resumes in one storage account, interview audio in another), or is one account with many containers enough for now? Current plan = one active account, many containers.

If you're happy with single-account + admin-only scope for this iteration, I'll proceed exactly as above.