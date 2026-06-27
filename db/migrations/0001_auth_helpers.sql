-- =====================================================================
-- 0001_auth_helpers.sql
-- Roles + security-definer helpers used by every later RLS policy.
-- Run this first in the new project's SQL editor.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";   -- for notes search (used in 0003)
create extension if not exists "citext";    -- for case-insensitive email (used in 0002)

-- ---------------------------------------------------------------------
-- Role enum + user_roles table
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('candidate', 'admin');
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

-- ---------------------------------------------------------------------
-- has_role(user, role) — for admin-or-self policies later
-- ---------------------------------------------------------------------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- ---------------------------------------------------------------------
-- auth_candidate_id() — returns candidates.id for the current auth user.
-- Every per-candidate RLS policy uses this so it's one indexed lookup
-- per statement, not a per-row subquery.
-- candidates table is created in 0002; this function resolves at runtime.
-- ---------------------------------------------------------------------
create or replace function public.auth_candidate_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.candidates where user_id = auth.uid() limit 1;
$$;

revoke all on function public.auth_candidate_id() from public;
grant execute on function public.auth_candidate_id()                      to authenticated, service_role;
grant execute on function public.has_role(uuid, public.app_role)          to authenticated, service_role;
