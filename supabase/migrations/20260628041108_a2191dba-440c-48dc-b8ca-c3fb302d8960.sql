ALTER TABLE public.practice_subtopics
  ADD COLUMN IF NOT EXISTS enabled_kinds text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_counts jsonb NOT NULL DEFAULT '{}'::jsonb;