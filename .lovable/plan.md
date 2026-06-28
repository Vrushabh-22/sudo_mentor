## Diagnosis

The Quick Profile Setup card (`ProfileFormCard`) calls `invokeV4({ action: 'patch_profile', ... })`. In our project, `src/lib/candidatePortalV4Client.ts` only implements `get_profile` and `list_my_tenants` — **everything else (including `patch_profile`) silently returns `{ data: {}, error: null }`**. So the form shows "Saved!" but **nothing is written to the database**.

That's why on the next mentor turn, AlphaMentor still sees `stream/institution/graduation_year/cgpa/skills` as unknown and the "Tell me about yourself" sample answer keeps showing `[Your Institution]`, `[Your Degree]` placeholders for `akshay.deshmukh@techademy.com`.

Target table already exists: `public.candidates` has the right columns — `stream`, `branch`, `institution`, `graduation_year` (int), `cgpa` (numeric), `skills_v4` (jsonb), plus `first_name`, `last_name`, `headline`, `bio`, `location`, `phone`, `avatar_url`, `resume_url`, and a `profile_extra` jsonb catch-all.

## Fix

Implement `patch_profile` in `src/lib/candidatePortalV4Client.ts`:

1. Get current session; resolve `candidates.id` via `user_id = auth.uid()`.
2. Whitelist known columns and update them directly on `candidates`:
   `first_name, last_name, phone, headline, bio (from "about"), location, avatar_url (from "photo_url"), resume_url, stream, branch, institution, graduation_year, cgpa, skills_v4, profile_completeness`.
3. Anything not in the whitelist (e.g. `linkedin_url`, `social_links`, `certifications`, `projects`) gets merged into the existing `profile_extra` jsonb so we don't lose extension fields.
4. Also normalize: if caller sends `skills` (string), `ProfileFormCard` already converts it to `skills_v4` — keep that. If caller sends legacy `skills` array of strings, mirror into the `skills` text[] column too.
5. Return `{ data: { ok: true }, error }`. RLS on `candidates` already lets a user update their own row (auth.uid() = user_id).

No DB migration needed — columns already exist.

## Verification

- Submit Quick Profile in mentor → run `select stream, institution, graduation_year, cgpa, skills_v4 from candidates where email='akshay.deshmukh@techademy.com'`. Values should be present.
- Re-open mentor and ask "Tell me about yourself" — sample answer should use real institution / degree / skills instead of `[Your Institution]` placeholders.

## Scope

Single file edit: `src/lib/candidatePortalV4Client.ts`. No schema changes, no edge function changes, no UI changes.
