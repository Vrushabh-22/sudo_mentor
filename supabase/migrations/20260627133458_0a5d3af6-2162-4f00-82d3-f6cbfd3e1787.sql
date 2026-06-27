
-- =========================================================
-- LLM Providers + Key Pool + Central Routing
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- providers ----------
create table public.llm_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  base_url text,
  default_model text,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index llm_providers_one_active on public.llm_providers (is_active) where is_active = true;

grant select, insert, update, delete on public.llm_providers to authenticated;
grant all on public.llm_providers to service_role;
alter table public.llm_providers enable row level security;
create policy llm_providers_admin_all on public.llm_providers for all to authenticated using (is_admin()) with check (is_admin());

create trigger llm_providers_touch before update on public.llm_providers
  for each row execute function tg_touch_updated_at();

-- ---------- api keys (pool) ----------
create table public.llm_api_keys (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.llm_providers(id) on delete cascade,
  label text not null,
  key_ciphertext text not null,        -- AES-GCM ciphertext (base64), encrypted by edge fn
  key_iv text not null,                -- base64 IV
  key_last4 text not null,
  enabled boolean not null default true,
  weight int not null default 1,
  last_used_at timestamptz,
  use_count bigint not null default 0,
  fail_count bigint not null default 0,
  cooldown_until timestamptz,
  created_at timestamptz not null default now()
);
create index llm_api_keys_provider_enabled_idx
  on public.llm_api_keys (provider_id, enabled, cooldown_until, last_used_at nulls first);

grant select, insert, update, delete on public.llm_api_keys to authenticated;
grant all on public.llm_api_keys to service_role;
alter table public.llm_api_keys enable row level security;
-- Admins see metadata; ciphertext column is filtered in the API layer (UI selects only safe cols).
create policy llm_api_keys_admin_all on public.llm_api_keys for all to authenticated using (is_admin()) with check (is_admin());

-- ---------- round-robin cursor ----------
create table public.llm_rr_cursor (
  provider_id uuid primary key references public.llm_providers(id) on delete cascade,
  last_key_id uuid,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.llm_rr_cursor to authenticated;
grant all on public.llm_rr_cursor to service_role;
alter table public.llm_rr_cursor enable row level security;
create policy llm_rr_cursor_admin_all on public.llm_rr_cursor for all to authenticated using (is_admin()) with check (is_admin());

-- ---------- call log (partitioned monthly) ----------
create table public.llm_call_log (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider_id uuid,
  key_id uuid,
  feature text not null,
  model text,
  status int,
  latency_ms int,
  prompt_tokens int,
  completion_tokens int,
  cache_hit boolean not null default false,
  error text,
  user_id uuid,
  primary key (id, created_at)
) partition by range (created_at);

-- default + a few forward partitions so writes always have a home
create table public.llm_call_log_default partition of public.llm_call_log default;
create table public.llm_call_log_2026_06 partition of public.llm_call_log
  for values from ('2026-06-01') to ('2026-07-01');
create table public.llm_call_log_2026_07 partition of public.llm_call_log
  for values from ('2026-07-01') to ('2026-08-01');
create table public.llm_call_log_2026_08 partition of public.llm_call_log
  for values from ('2026-08-01') to ('2026-09-01');
create table public.llm_call_log_2026_09 partition of public.llm_call_log
  for values from ('2026-09-01') to ('2026-10-01');

create index llm_call_log_feature_created_idx on public.llm_call_log (feature, created_at desc);
create index llm_call_log_provider_created_idx on public.llm_call_log (provider_id, created_at desc);

grant select on public.llm_call_log to authenticated;
grant all on public.llm_call_log to service_role;
alter table public.llm_call_log enable row level security;
create policy llm_call_log_admin_read on public.llm_call_log for select to authenticated using (is_admin());

-- ---------- response cache ----------
create table public.llm_cache (
  cache_key text primary key,
  response jsonb not null,
  model text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index llm_cache_expires_idx on public.llm_cache (expires_at);

grant select, insert, update, delete on public.llm_cache to authenticated;
grant all on public.llm_cache to service_role;
alter table public.llm_cache enable row level security;
create policy llm_cache_admin_all on public.llm_cache for all to authenticated using (is_admin()) with check (is_admin());

-- =========================================================
-- Helper functions (SECURITY DEFINER so service role/edge fn can call)
-- =========================================================

-- Pick next eligible key for the active provider using least-recently-used round-robin.
-- Returns key id, ciphertext, iv, provider slug, default model, base_url, config.
create or replace function public.llm_pick_next_key()
returns table (
  key_id uuid,
  ciphertext text,
  iv text,
  provider_id uuid,
  provider_slug text,
  base_url text,
  default_model text,
  config jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
  v_provider_slug text;
  v_base_url text;
  v_default_model text;
  v_config jsonb;
  v_key_id uuid;
  v_ciphertext text;
  v_iv text;
begin
  select p.id, p.slug, p.base_url, p.default_model, p.config
    into v_provider_id, v_provider_slug, v_base_url, v_default_model, v_config
  from public.llm_providers p
  where p.is_active and p.enabled
  limit 1;

  if v_provider_id is null then
    return;
  end if;

  -- Lock + pick LRU eligible key (skip locked rows so concurrent callers don't collide).
  select k.id, k.key_ciphertext, k.key_iv
    into v_key_id, v_ciphertext, v_iv
  from public.llm_api_keys k
  where k.provider_id = v_provider_id
    and k.enabled
    and (k.cooldown_until is null or k.cooldown_until < now())
  order by coalesce(k.last_used_at, 'epoch'::timestamptz) asc, k.id asc
  for update skip locked
  limit 1;

  if v_key_id is null then
    return;
  end if;

  update public.llm_api_keys
     set last_used_at = now(),
         use_count = use_count + 1
   where id = v_key_id;

  insert into public.llm_rr_cursor (provider_id, last_key_id, updated_at)
  values (v_provider_id, v_key_id, now())
  on conflict (provider_id) do update set last_key_id = excluded.last_key_id, updated_at = now();

  key_id := v_key_id;
  ciphertext := v_ciphertext;
  iv := v_iv;
  provider_id := v_provider_id;
  provider_slug := v_provider_slug;
  base_url := v_base_url;
  default_model := v_default_model;
  config := v_config;
  return next;
end;
$$;

revoke all on function public.llm_pick_next_key() from public, anon, authenticated;
grant execute on function public.llm_pick_next_key() to service_role;

-- Record a completed call (success or failure).
create or replace function public.llm_record_call(
  _provider_id uuid,
  _key_id uuid,
  _feature text,
  _model text,
  _status int,
  _latency_ms int,
  _prompt_tokens int,
  _completion_tokens int,
  _cache_hit boolean,
  _error text,
  _user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.llm_call_log
    (provider_id, key_id, feature, model, status, latency_ms, prompt_tokens, completion_tokens, cache_hit, error, user_id)
  values
    (_provider_id, _key_id, _feature, _model, _status, _latency_ms, _prompt_tokens, _completion_tokens, _cache_hit, _error, _user_id);

  if _key_id is not null and _status is not null and (_status >= 500 or _status = 429) then
    update public.llm_api_keys
       set fail_count = fail_count + 1
     where id = _key_id;
  end if;
end;
$$;
revoke all on function public.llm_record_call(uuid,uuid,text,text,int,int,int,int,boolean,text,uuid) from public, anon, authenticated;
grant execute on function public.llm_record_call(uuid,uuid,text,text,int,int,int,int,boolean,text,uuid) to service_role;

-- Put a key on cooldown.
create or replace function public.llm_cooldown_key(_key_id uuid, _minutes int)
returns void language sql security definer set search_path = public as $$
  update public.llm_api_keys
     set cooldown_until = now() + make_interval(mins => greatest(_minutes, 1))
   where id = _key_id;
$$;
revoke all on function public.llm_cooldown_key(uuid,int) from public, anon, authenticated;
grant execute on function public.llm_cooldown_key(uuid,int) to service_role;

-- Admin: set exactly one provider active.
create or replace function public.llm_set_active_provider(_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  update public.llm_providers set is_active = false where is_active = true;
  update public.llm_providers set is_active = true, enabled = true where id = _provider_id;
end;
$$;
revoke all on function public.llm_set_active_provider(uuid) from public, anon;
grant execute on function public.llm_set_active_provider(uuid) to authenticated;

-- =========================================================
-- Seed providers (disabled until keys are added; admin chooses which is active)
-- =========================================================
insert into public.llm_providers (slug, display_name, base_url, default_model, config, enabled, is_active) values
  ('openai',       'OpenAI',              'https://api.openai.com/v1',                 'gpt-4o-mini',                  '{}'::jsonb, true,  false),
  ('azure_openai', 'Azure OpenAI',        null,                                        'gpt-4o-mini',                  '{"api_version":"2024-08-01-preview","deployment":""}'::jsonb, true, false),
  ('groq',         'Groq',                'https://api.groq.com/openai/v1',            'llama-3.3-70b-versatile',      '{}'::jsonb, true,  false),
  ('anthropic',    'Anthropic',           'https://api.anthropic.com/v1',              'claude-3-5-sonnet-latest',     '{}'::jsonb, true,  false),
  ('gemini',       'Google Gemini',       'https://generativelanguage.googleapis.com/v1beta', 'gemini-2.5-flash',     '{}'::jsonb, true,  false),
  ('lovable',      'Lovable AI Gateway',  'https://ai.gateway.lovable.dev/v1',         'google/gemini-3-flash-preview','{}'::jsonb, true,  true)
on conflict (slug) do nothing;
