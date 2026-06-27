## LLM Providers + central `llm_caller` — plan

Replace the current "Azure OpenAI + Default LLM" cards in `/admin → Settings` with a proper provider/key management system, and route every AI call in the portal through one edge function with round-robin key rotation, caching, and observability.

### 1. Database (new tables, separate from `app_settings`)

```text
llm_providers
  id uuid pk
  slug text unique         -- 'openai' | 'azure_openai' | 'groq' | 'anthropic' | 'lovable' | 'gemini'
  display_name text
  base_url text            -- optional override (Azure endpoint, self-hosted, etc.)
  default_model text
  config jsonb             -- provider-specific (api_version, deployment, region…)
  enabled boolean
  is_active boolean        -- exactly one row true = currently selected provider
  created_at / updated_at

llm_api_keys                -- the "pool"
  id uuid pk
  provider_id uuid fk -> llm_providers
  label text                -- "prod-key-1"
  key_ciphertext text       -- encrypted with pgcrypto (pgp_sym_encrypt + vault key)
  key_last4 text            -- shown in UI
  enabled boolean
  weight int default 1      -- round-robin weight
  last_used_at timestamptz
  use_count bigint default 0
  fail_count int default 0
  cooldown_until timestamptz -- auto-disable on 429/5xx
  created_at

llm_call_log                -- lightweight observability (partitioned monthly for B2C scale)
  id uuid, provider_id, key_id, feature text, model text,
  status int, latency_ms int, prompt_tokens int, completion_tokens int,
  cache_hit boolean, error text, created_at timestamptz

llm_cache                   -- optional response cache
  cache_key text pk         -- sha256(provider|model|messages|tools|temp)
  response jsonb
  expires_at timestamptz
```

RLS: admin-only read/write on providers/keys/log; service_role full access (edge function uses it). Keys never returned to client unencrypted — admin UI only shows `label` + `key_last4`.

Encryption: pgcrypto symmetric using `LLM_KEYS_ENC_SECRET` (generated secret, edge-function side). All encrypt/decrypt happens inside the edge function or SECURITY DEFINER helpers — never in the browser.

### 2. Central edge function: `llm-caller`

Single boundary for **every** AI call in the portal (Mentor, Practice, Project eval, note-cover, summaries, etc.).

Contract:
```
POST /functions/v1/llm-caller
{
  feature: "mentor.chat" | "practice.quiz" | "project.eval" | ...,
  mode: "chat" | "stream" | "json",
  messages: [...],          // OpenAI-style
  schema?: {...},           // for structured output
  temperature?, max_tokens?, tools?,
  cache?: { ttl_seconds: number } // opt-in caching
}
```

Internals (in this order):
1. Auth: require valid candidate or admin JWT.
2. Load active provider + enabled, non-cooling keys (cached in memory ~30s).
3. Cache check (if `cache.ttl_seconds` and `mode != stream`).
4. Round-robin key pick (advance pointer in Postgres via `SELECT ... FOR UPDATE SKIP LOCKED` on a tiny `llm_rr_cursor` row, weighted).
5. Build provider-specific request (OpenAI / Azure / Groq / Gemini adapters in one file).
6. Stream via SSE for `mode=stream`; otherwise return JSON.
7. On 429/5xx: mark key `cooldown_until = now() + Nm`, retry next key (max N attempts), log failure.
8. On success: update `last_used_at`, increment counters, log latency/tokens, write cache if requested.

All other functions (mentor, project-eval, etc.) **must** call `llm-caller` via internal `fetch` — no `LOVABLE_API_KEY` / OpenAI SDK usage anywhere else. A `_shared/llmClient.ts` helper exposes `callLLM()` and `streamLLM()` so functions don't duplicate fetch boilerplate.

### 3. Admin UI changes (`/admin → Settings`)

Replace Azure + Default LLM cards with a single "LLM Providers" section:

- **Provider selector** (dropdown): OpenAI / Azure OpenAI / Groq / Anthropic / Gemini / Lovable AI Gateway. Only one is "Active".
- **Per-provider config form** (shown when that provider row is selected): base_url, default_model, api_version/deployment (Azure-only fields appear conditionally), temperature default.
- **API key pool table** for the active provider:
  - Columns: Label, key (•••• + last 4), enabled toggle, weight, last used, success/fail counts, cooldown, delete.
  - "Add key" button → modal asking label + raw key; submitted to `admin-llm-keys` edge function which encrypts + inserts. Raw key never stored in React state beyond submit.
- **Test button** per key → calls `llm-caller` with `feature=admin.test` and shows latency/model echo.

Google OAuth + Branding cards stay as-is in `app_settings`.

### 4. Supporting edge functions

- `admin-llm-keys` — admin-only CRUD for keys (encrypts on insert, never returns plaintext).
- `llm-caller` — the only AI call boundary.
- Refactor any existing/future feature functions (mentor chat, project eval, etc.) to call `llm-caller` exclusively. Phase 1 ships the plumbing; we wire features as each is built.

### 5. Secrets

- `LLM_KEYS_ENC_SECRET` — generated, used by pgcrypto for key encryption.
- `LOVABLE_API_KEY` — kept; "Lovable AI Gateway" becomes one selectable provider so we always have a working fallback.

### 6. Scale notes (lakhs of users)

- Provider/keys loaded with 30s in-memory TTL inside the function instance — avoids hitting DB on every call.
- Round-robin cursor uses a single row + `SKIP LOCKED` so concurrent function instances don't contend.
- `llm_call_log` declared as monthly partitioned table from day one.
- `llm_cache` GC via a daily cron deleting `expires_at < now()`.
- All key reads via SECURITY DEFINER RPC so RLS stays strict.

### Out of scope for this step
- Wiring existing components to `llm-caller` (done feature-by-feature in their phases).
- Per-tenant key isolation (single-tenant B2C, not needed).

If approved I'll: run the migration, generate `LLM_KEYS_ENC_SECRET`, ship the two edge functions, and replace the Azure/Default-LLM cards in `AdminSettings` with the new Provider + Key-pool UI.