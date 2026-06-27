-- =====================================================================
-- 0002_candidates.sql
-- candidates (profile), tenants, tenant_memberships.
-- Auto-creates candidate row + 'candidate' role on every auth signup.
-- =====================================================================

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
  -- Flexible per-candidate blob (education, experience, social links, etc.)
  profile_extra   jsonb not null default '{}'::jsonb,
  xp_total        integer not null default 0,
  streak_days     integer not null default 0,
  last_active_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists candidates_email_idx       on public.candidates (email);
create index if not exists candidates_last_active_idx on public.candidates (last_active_at desc nulls last);
create index if not exists candidates_skills_gin      on public.candidates using gin (skills);

grant select, insert, update on public.candidates to authenticated;
grant all on public.candidates to service_role;

alter table public.candidates enable row level security;

create policy "candidates_self_read"
  on public.candidates for select
  to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "candidates_self_update"
  on public.candidates for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- INSERT is done by the on-signup trigger (service_role). No candidate self-insert.

-- ---------------------------------------------------------------------
-- on_auth_user_created — create candidate row + 'candidate' role
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Shared updated_at touch trigger
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists candidates_touch on public.candidates;
create trigger candidates_touch
  before update on public.candidates
  for each row execute function public.tg_touch_updated_at();

-- ---------------------------------------------------------------------
-- Tenants + memberships (V4 tenant switcher / multi-org candidates)
-- We mirror the minimum from ATS; full org details stay in ATS.
-- ---------------------------------------------------------------------
create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  ats_tenant_id uuid unique,           -- pointer back to ATS project
  name          text not null,
  slug          text unique,
  logo_url      text,
  created_at    timestamptz not null default now()
);

create table if not exists public.tenant_memberships (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id)    on delete cascade,
  is_primary    boolean not null default false,
  joined_at     timestamptz not null default now(),
  unique (candidate_id, tenant_id)
);

create index if not exists memberships_candidate_idx on public.tenant_memberships (candidate_id);

grant select on public.tenants            to authenticated;
grant all    on public.tenants            to service_role;
grant select on public.tenant_memberships to authenticated;
grant all    on public.tenant_memberships to service_role;

alter table public.tenants            enable row level security;
alter table public.tenant_memberships enable row level security;

create policy "tenants_member_read"
  on public.tenants for select
  to authenticated
  using (
    exists (
      select 1 from public.tenant_memberships m
      where m.tenant_id    = tenants.id
        and m.candidate_id = public.auth_candidate_id()
    )
  );

create policy "memberships_self_read"
  on public.tenant_memberships for select
  to authenticated
  using (candidate_id = public.auth_candidate_id());
