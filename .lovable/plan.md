## Problem

`mentor-copilot-chat` → `llm-caller` returns 500:
`column reference "provider_id" is ambiguous`

Source: the `public.llm_pick_next_key()` function declares `OUT` columns named `provider_id`, `key_id`, etc. Inside the function body, PL/pgSQL can't tell whether `provider_id` refers to the OUT parameter or to a table column. The offending statement is:

```sql
insert into public.llm_rr_cursor (provider_id, last_key_id, updated_at)
values (v_provider_id, v_key_id, now())
on conflict (provider_id) do update ...
```

Postgres treats `on conflict (provider_id)` as ambiguous because `provider_id` is also an OUT parameter name in scope.

## Fix

Run a migration that replaces `public.llm_pick_next_key()` with the same logic, but:

1. Rename OUT parameters to non-colliding names: `out_key_id`, `out_ciphertext`, `out_iv`, `out_provider_id`, `out_provider_slug`, `out_base_url`, `out_default_model`, `out_config`.
2. Update assignments at the end to set those renamed OUTs.
3. Keep all other behavior identical (LRU pick with `for update skip locked`, last_used/use_count bump, rr_cursor upsert).

Because edge functions read `pick.provider_id` and `pick.key_id` from the RPC result, also: the returned column names must stay `provider_id`, `key_id`, etc. PostgREST exposes RETURNS TABLE columns by their declared names. So instead of renaming OUTs, the safer fix is to keep TABLE column names and qualify every internal reference:

- Replace `on conflict (provider_id)` with explicit constraint name, or qualify via a table alias: `insert into public.llm_rr_cursor as c (...) values (...) on conflict (provider_id) do update ...` — using the `as c` alias resolves the ambiguity because the conflict target then unambiguously refers to the target table's column.

Chosen approach: keep `RETURNS TABLE(... provider_id uuid, key_id uuid, ...)` signature unchanged (so the edge function and clients don't change), and fix only the ambiguous statement by adding a table alias on the upsert:

```sql
insert into public.llm_rr_cursor as c (provider_id, last_key_id, updated_at)
values (v_provider_id, v_key_id, now())
on conflict (provider_id)
do update set last_key_id = excluded.last_key_id, updated_at = now();
```

If Postgres still flags it, fall back to renaming the RETURNS TABLE columns to `o_provider_id`, `o_key_id`, ... and updating the two call sites in `supabase/functions/llm-caller/index.ts` to read `pick.o_provider_id` / `pick.o_key_id` (plus `logCall` signature).

## Steps

1. Migration: `CREATE OR REPLACE FUNCTION public.llm_pick_next_key()` with the alias fix.
2. Redeploy `llm-caller` (no code change needed if alias fix works).
3. Verify by sending a chat message in MentorCopilot and checking `mentor-copilot-chat` logs are clean and a row appears in `llm_call_log`.

No frontend changes required.