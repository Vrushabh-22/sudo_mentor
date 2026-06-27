The error is still the same: `llm-caller` returns `column reference "provider_id" is ambiguous` from the database RPC `public.llm_pick_next_key()`.

Plan:
1. Replace `public.llm_pick_next_key()` with a safer version that avoids all output-column name collisions inside PL/pgSQL.
2. Keep the public RPC return column names unchanged (`key_id`, `ciphertext`, `iv`, `provider_id`, etc.) so `llm-caller` code does not need to change.
3. Implement the function using `RETURN QUERY SELECT ...` from local variables instead of assigning to output variables like `provider_id := ...`.
4. Change the cursor upsert to avoid `ON CONFLICT (provider_id)` entirely by using `ON CONSTRAINT llm_rr_cursor_pkey`, which removes the last ambiguous reference.
5. After migration approval, test `llm_pick_next_key()` directly, then call `mentor-copilot-chat`/check logs to confirm the ambiguity is gone.

Technical note:
- The previous alias patch is present in DB, but PL/pgSQL can still treat `provider_id` as ambiguous because `RETURNS TABLE(... provider_id ...)` creates an output variable in function scope. The robust fix is to stop referencing or assigning that output variable anywhere in procedural statements and return a selected row at the end.