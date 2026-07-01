ALTER TABLE public.practice_daily_workout ADD COLUMN IF NOT EXISTS pillar_id uuid REFERENCES public.practice_pillars(id) ON DELETE SET NULL;
ALTER TABLE public.practice_daily_workout DROP CONSTRAINT IF EXISTS practice_daily_workout_candidate_id_workout_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS practice_daily_workout_cand_date_pillar_uk
  ON public.practice_daily_workout (candidate_id, workout_date, coalesce(pillar_id, '00000000-0000-0000-0000-000000000000'::uuid));