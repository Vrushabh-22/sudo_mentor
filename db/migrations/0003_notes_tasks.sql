-- =====================================================================
-- 0003_notes_tasks.sql
-- candidate_notes (Notes workspace, Tiptap content + trigram search)
-- candidate_project_tasks (kanban board)
-- Indexes match the literal queries in the ported V4 UI.
-- =====================================================================

-- ---------------------------------------------------------------------
-- candidate_notes
-- Sidebar hot query:
--   WHERE candidate_id = ? AND is_archived = false
--   ORDER BY is_pinned DESC, updated_at DESC
-- Composite index below serves it as an index-only scan.
-- ---------------------------------------------------------------------
create table if not exists public.candidate_notes (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  title         text not null default 'Untitled',
  content       jsonb not null default '{}'::jsonb,     -- Tiptap doc
  content_text  text  not null default '',              -- flat shadow for trigram search
  cover_url     text,
  is_pinned     boolean not null default false,
  is_archived   boolean not null default false,
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists notes_sidebar_idx
  on public.candidate_notes (candidate_id, is_archived, is_pinned desc, updated_at desc);

create index if not exists notes_text_trgm
  on public.candidate_notes using gin (content_text gin_trgm_ops);

create index if not exists notes_tags_gin
  on public.candidate_notes using gin (tags);

grant select, insert, update, delete on public.candidate_notes to authenticated;
grant all on public.candidate_notes to service_role;

alter table public.candidate_notes enable row level security;

create policy "notes_owner_all"
  on public.candidate_notes for all
  to authenticated
  using (candidate_id = public.auth_candidate_id())
  with check (candidate_id = public.auth_candidate_id());

-- Touch updated_at + refresh content_text shadow for search
create or replace function public.tg_notes_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  -- Pull every "text" string from the Tiptap doc into a flat field for trigram search.
  begin
    new.content_text := coalesce(
      (
        select string_agg(value::text, ' ')
        from jsonb_path_query(new.content, 'strict $.**.text ? (@.type() == "string")') as value
      ),
      ''
    );
  exception when others then
    new.content_text := '';
  end;
  return new;
end $$;

drop trigger if exists notes_touch on public.candidate_notes;
create trigger notes_touch
  before insert or update on public.candidate_notes
  for each row execute function public.tg_notes_touch();

-- ---------------------------------------------------------------------
-- candidate_project_tasks (kanban)
-- Hot query: WHERE candidate_id = ? AND status = ? ORDER BY position
-- Fractional `position` so reorders update only the moved row.
-- ---------------------------------------------------------------------
do $$ begin
  create type public.task_status as enum ('todo', 'in_progress', 'done');
exception when duplicate_object then null; end $$;

create table if not exists public.candidate_project_tasks (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  project_id    uuid,                                       -- nullable; FK added in phase 2
  title         text not null,
  description   text,
  status        public.task_status not null default 'todo',
  position      double precision not null default 1000,
  due_at        timestamptz,
  completed_at  timestamptz,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists tasks_kanban_idx
  on public.candidate_project_tasks (candidate_id, status, position);

create index if not exists tasks_project_idx
  on public.candidate_project_tasks (candidate_id, project_id)
  where project_id is not null;

grant select, insert, update, delete on public.candidate_project_tasks to authenticated;
grant all on public.candidate_project_tasks to service_role;

alter table public.candidate_project_tasks enable row level security;

create policy "tasks_owner_all"
  on public.candidate_project_tasks for all
  to authenticated
  using (candidate_id = public.auth_candidate_id())
  with check (candidate_id = public.auth_candidate_id());

drop trigger if exists tasks_touch on public.candidate_project_tasks;
create trigger tasks_touch
  before update on public.candidate_project_tasks
  for each row execute function public.tg_touch_updated_at();
