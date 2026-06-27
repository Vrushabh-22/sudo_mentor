alter table public.candidates
  add column if not exists first_name         text,
  add column if not exists last_name          text,
  add column if not exists stream             text,
  add column if not exists branch             text,
  add column if not exists institution        text,
  add column if not exists graduation_year    int,
  add column if not exists cgpa               numeric(4,2),
  add column if not exists skills_v4          jsonb not null default '[]'::jsonb,
  add column if not exists profile_completeness int not null default 0,
  add column if not exists last_active_on     date;

update public.candidates
   set first_name = split_part(coalesce(full_name,''),' ',1),
       last_name  = trim(substring(coalesce(full_name,'') from position(' ' in coalesce(full_name,'')||' ')+1))
 where first_name is null;

create table if not exists public.candidate_mentor_sessions (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  title         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
grant select, insert, update, delete on public.candidate_mentor_sessions to authenticated;
grant all on public.candidate_mentor_sessions to service_role;
alter table public.candidate_mentor_sessions enable row level security;
create policy cms_owner on public.candidate_mentor_sessions for all to authenticated
  using (candidate_id in (select id from public.candidates where user_id = auth.uid()) or public.is_admin())
  with check (candidate_id in (select id from public.candidates where user_id = auth.uid()));
create index if not exists cms_candidate_updated_idx
  on public.candidate_mentor_sessions (candidate_id, updated_at desc, created_at desc);
create trigger cms_touch before update on public.candidate_mentor_sessions
  for each row execute function public.tg_touch_updated_at();

create table if not exists public.candidate_mentor_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.candidate_mentor_sessions(id) on delete cascade,
  role        text not null check (role in ('user','assistant','system')),
  content     text not null,
  created_at  timestamptz not null default now()
);
grant select, insert, update, delete on public.candidate_mentor_messages to authenticated;
grant all on public.candidate_mentor_messages to service_role;
alter table public.candidate_mentor_messages enable row level security;
create policy cmm_owner on public.candidate_mentor_messages for all to authenticated
  using (session_id in (select s.id from public.candidate_mentor_sessions s
                        join public.candidates c on c.id = s.candidate_id
                        where c.user_id = auth.uid()) or public.is_admin())
  with check (session_id in (select s.id from public.candidate_mentor_sessions s
                             join public.candidates c on c.id = s.candidate_id
                             where c.user_id = auth.uid()));
create index if not exists cmm_session_created_idx
  on public.candidate_mentor_messages (session_id, created_at desc);

create table if not exists public.candidate_mentor_memory (
  candidate_id uuid primary key references public.candidates(id) on delete cascade,
  target_company text,
  target_role    text,
  weak_topics    jsonb not null default '[]'::jsonb,
  last_topics    jsonb not null default '[]'::jsonb,
  mood_last      text,
  summary        text,
  streak_days    int not null default 0,
  last_seen_at   timestamptz,
  last_streak_mention_on date,
  updated_at     timestamptz not null default now()
);
grant select, insert, update, delete on public.candidate_mentor_memory to authenticated;
grant all on public.candidate_mentor_memory to service_role;
alter table public.candidate_mentor_memory enable row level security;
create policy cmem_owner on public.candidate_mentor_memory for all to authenticated
  using (candidate_id in (select id from public.candidates where user_id = auth.uid()) or public.is_admin())
  with check (candidate_id in (select id from public.candidates where user_id = auth.uid()));
create trigger cmem_touch before update on public.candidate_mentor_memory
  for each row execute function public.tg_touch_updated_at();

create table if not exists public.learning_paths_catalog (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  slug            text not null unique,
  description     text,
  skill_primary   text not null,
  skills          text[] not null default '{}',
  tags            text[] not null default '{}',
  stream          text[] not null default '{}',
  level           text not null default 'beginner',
  estimated_hours numeric(5,1) not null default 0,
  modules         jsonb not null default '[]'::jsonb,
  source          text not null default 'youtube_curated',
  is_published    boolean not null default true,
  usage_count     bigint not null default 0,
  rating_avg      numeric(3,2) not null default 0,
  rating_count    int not null default 0,
  created_by      uuid references public.candidates(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
grant select on public.learning_paths_catalog to authenticated;
grant all on public.learning_paths_catalog to service_role;
alter table public.learning_paths_catalog enable row level security;
create policy lpc_read on public.learning_paths_catalog for select to authenticated
  using (is_published or public.is_admin());
create index if not exists lpc_skill_idx  on public.learning_paths_catalog (skill_primary) where is_published;
create index if not exists lpc_usage_idx  on public.learning_paths_catalog (usage_count desc) where is_published;
create index if not exists lpc_tags_gin   on public.learning_paths_catalog using gin (tags);
create index if not exists lpc_skills_gin on public.learning_paths_catalog using gin (skills);
create trigger lpc_touch before update on public.learning_paths_catalog
  for each row execute function public.tg_touch_updated_at();

create table if not exists public.candidate_lp_enrollments (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid not null references public.candidates(id) on delete cascade,
  path_id         uuid not null references public.learning_paths_catalog(id) on delete cascade,
  last_video_id   text,
  last_activity_at timestamptz not null default now(),
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (candidate_id, path_id)
);
grant select, insert, update, delete on public.candidate_lp_enrollments to authenticated;
grant all on public.candidate_lp_enrollments to service_role;
alter table public.candidate_lp_enrollments enable row level security;
create policy cle_owner on public.candidate_lp_enrollments for all to authenticated
  using (candidate_id in (select id from public.candidates where user_id = auth.uid()) or public.is_admin())
  with check (candidate_id in (select id from public.candidates where user_id = auth.uid()));
create index if not exists cle_candidate_activity_idx on public.candidate_lp_enrollments (candidate_id, last_activity_at desc);

create table if not exists public.candidate_lp_video_progress (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  path_id       uuid not null references public.learning_paths_catalog(id) on delete cascade,
  video_id      text not null,
  watched_sec   int not null default 0,
  duration_sec  int,
  completed     boolean not null default false,
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  unique (candidate_id, path_id, video_id)
);
grant select, insert, update, delete on public.candidate_lp_video_progress to authenticated;
grant all on public.candidate_lp_video_progress to service_role;
alter table public.candidate_lp_video_progress enable row level security;
create policy clvp_owner on public.candidate_lp_video_progress for all to authenticated
  using (candidate_id in (select id from public.candidates where user_id = auth.uid()) or public.is_admin())
  with check (candidate_id in (select id from public.candidates where user_id = auth.uid()));
create index if not exists clvp_lookup_idx on public.candidate_lp_video_progress (candidate_id, path_id);

create table if not exists public.candidate_xp_events (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  event_type    text not null,
  xp            int not null,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
grant select, insert on public.candidate_xp_events to authenticated;
grant all on public.candidate_xp_events to service_role;
alter table public.candidate_xp_events enable row level security;
create policy cxe_owner on public.candidate_xp_events for all to authenticated
  using (candidate_id in (select id from public.candidates where user_id = auth.uid()) or public.is_admin())
  with check (candidate_id in (select id from public.candidates where user_id = auth.uid()));
create index if not exists cxe_candidate_created_idx on public.candidate_xp_events (candidate_id, created_at desc);
