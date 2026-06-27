
-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "citext";

-- ============ Roles ============
do $$ begin
  create type public.app_role as enum ('admin', 'candidate');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.app_role not null,
  created_at  timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all    on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "user_roles_self_read"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_admin()                       to authenticated, service_role;

-- ============ Shared updated_at trigger ============
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============ Candidates ============
create table if not exists public.candidates (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  email           citext,
  full_name       text,
  avatar_url      text,
  phone           text,
  headline        text,
  bio             text,
  resume_url      text,
  resume_filename text,
  location        text,
  skills          text[] not null default '{}',
  profile_extra   jsonb  not null default '{}'::jsonb,
  xp_total        integer not null default 0,
  streak_days     integer not null default 0,
  last_active_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists candidates_email_idx          on public.candidates (email);
create index if not exists candidates_last_active_idx    on public.candidates (last_active_at desc nulls last, id desc);
create index if not exists candidates_created_at_idx     on public.candidates (created_at desc, id desc);
create index if not exists candidates_skills_gin         on public.candidates using gin (skills);
create index if not exists candidates_fullname_trgm_idx  on public.candidates using gin (lower(full_name) gin_trgm_ops);
create index if not exists candidates_email_trgm_idx     on public.candidates using gin ((email::text) gin_trgm_ops);

grant select, insert, update on public.candidates to authenticated;
grant all on public.candidates to service_role;

alter table public.candidates enable row level security;

create policy "candidates_self_read"
  on public.candidates for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "candidates_self_update"
  on public.candidates for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "candidates_self_insert"
  on public.candidates for insert to authenticated
  with check (user_id = auth.uid());

drop trigger if exists candidates_touch on public.candidates;
create trigger candidates_touch before update on public.candidates
  for each row execute function public.tg_touch_updated_at();

-- ============ Auto-create candidate on signup ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.candidates (user_id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'candidate')
  on conflict do nothing;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ App settings ============
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

grant select, insert, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

alter table public.app_settings enable row level security;

create policy "app_settings_admin_read"
  on public.app_settings for select to authenticated
  using (public.is_admin());

create policy "app_settings_admin_write"
  on public.app_settings for insert to authenticated
  with check (public.is_admin());

create policy "app_settings_admin_update"
  on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.tg_touch_updated_at();

-- Seed default empty settings
insert into public.app_settings (key, value) values
  ('azure_openai', '{"endpoint":"","deployment":"","api_version":"2024-06-01"}'::jsonb),
  ('llm_default',  '{"provider":"azure_openai","model":"","temperature":0.3}'::jsonb),
  ('google_oauth', '{"client_id":""}'::jsonb),
  ('branding',     '{"name":"SudoMentor","logo_url":""}'::jsonb)
on conflict (key) do nothing;
