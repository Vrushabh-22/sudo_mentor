
-- =========================================================
-- 1. Content tables (admin-managed)
-- =========================================================

CREATE TABLE public.practice_pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  color text,
  sort_order int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  is_stream_aware boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.practice_pillars TO anon, authenticated;
GRANT ALL ON public.practice_pillars TO service_role;
ALTER TABLE public.practice_pillars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pillars readable by all" ON public.practice_pillars FOR SELECT USING (true);
CREATE POLICY "pillars admin write" ON public.practice_pillars FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.practice_subtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id uuid NOT NULL REFERENCES public.practice_pillars(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  default_difficulty text NOT NULL DEFAULT 'medium',
  default_kind text NOT NULL DEFAULT 'mcq',
  time_budget_seconds int NOT NULL DEFAULT 180,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pillar_id, slug)
);
CREATE INDEX idx_subtopics_pillar ON public.practice_subtopics(pillar_id, sort_order);
GRANT SELECT ON public.practice_subtopics TO anon, authenticated;
GRANT ALL ON public.practice_subtopics TO service_role;
ALTER TABLE public.practice_subtopics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subtopics readable" ON public.practice_subtopics FOR SELECT USING (true);
CREATE POLICY "subtopics admin write" ON public.practice_subtopics FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.practice_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subtopic_id uuid NOT NULL REFERENCES public.practice_subtopics(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('mcq','speech','scenario','writing','mock')),
  system_prompt text NOT NULL DEFAULT '',
  user_prompt_template text NOT NULL DEFAULT '',
  few_shot jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_json jsonb,
  model_override text,
  temperature numeric(3,2) NOT NULL DEFAULT 0.7,
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prompts_subtopic ON public.practice_prompts(subtopic_id, is_active);
GRANT SELECT ON public.practice_prompts TO authenticated;
GRANT ALL ON public.practice_prompts TO service_role;
ALTER TABLE public.practice_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prompts admin read" ON public.practice_prompts FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "prompts admin write" ON public.practice_prompts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.practice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subtopic_id uuid NOT NULL REFERENCES public.practice_subtopics(id) ON DELETE CASCADE,
  prompt_id uuid REFERENCES public.practice_prompts(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'mcq',
  payload jsonb NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium',
  stream_tag text,
  source text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin','llm')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  quality_score numeric(4,2),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_items_subtopic_status ON public.practice_items(subtopic_id, status);
CREATE INDEX idx_items_stream ON public.practice_items(stream_tag) WHERE stream_tag IS NOT NULL;
GRANT SELECT ON public.practice_items TO authenticated;
GRANT ALL ON public.practice_items TO service_role;
ALTER TABLE public.practice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items readable by auth approved" ON public.practice_items FOR SELECT TO authenticated USING (status = 'approved' OR public.is_admin());
CREATE POLICY "items admin write" ON public.practice_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================
-- 2. Candidate workout & attempts
-- =========================================================

CREATE TABLE public.practice_daily_workout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  workout_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  total_xp int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, workout_date)
);
CREATE INDEX idx_workout_candidate_date ON public.practice_daily_workout(candidate_id, workout_date DESC);
GRANT SELECT, INSERT, UPDATE ON public.practice_daily_workout TO authenticated;
GRANT ALL ON public.practice_daily_workout TO service_role;
ALTER TABLE public.practice_daily_workout ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workout owner all" ON public.practice_daily_workout FOR ALL TO authenticated
  USING (candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid()) OR public.is_admin())
  WITH CHECK (candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid()) OR public.is_admin());

CREATE TABLE public.practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  workout_id uuid REFERENCES public.practice_daily_workout(id) ON DELETE SET NULL,
  pillar_id uuid REFERENCES public.practice_pillars(id) ON DELETE SET NULL,
  subtopic_id uuid REFERENCES public.practice_subtopics(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.practice_items(id) ON DELETE SET NULL,
  kind text,
  answer jsonb,
  score numeric(5,2),
  is_correct boolean,
  latency_ms int,
  ai_feedback jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attempts_candidate ON public.practice_attempts(candidate_id, created_at DESC);
CREATE INDEX idx_attempts_pillar ON public.practice_attempts(pillar_id, created_at DESC);
GRANT SELECT, INSERT ON public.practice_attempts TO authenticated;
GRANT ALL ON public.practice_attempts TO service_role;
ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attempts owner read" ON public.practice_attempts FOR SELECT TO authenticated
  USING (candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "attempts owner insert" ON public.practice_attempts FOR INSERT TO authenticated
  WITH CHECK (candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid()));

-- =========================================================
-- 3. Career fitness scores
-- =========================================================

CREATE TABLE public.career_fitness_scores (
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  pillar_id uuid NOT NULL REFERENCES public.practice_pillars(id) ON DELETE CASCADE,
  score numeric(5,2) NOT NULL DEFAULT 0,
  attempts_count int NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, pillar_id)
);
CREATE INDEX idx_fitness_candidate ON public.career_fitness_scores(candidate_id);
GRANT SELECT, INSERT, UPDATE ON public.career_fitness_scores TO authenticated;
GRANT ALL ON public.career_fitness_scores TO service_role;
ALTER TABLE public.career_fitness_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fitness owner read" ON public.career_fitness_scores FOR SELECT TO authenticated
  USING (candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "fitness owner write" ON public.career_fitness_scores FOR ALL TO authenticated
  USING (candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid()) OR public.is_admin())
  WITH CHECK (candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid()) OR public.is_admin());

-- Partitioned daily snapshots
CREATE TABLE public.career_fitness_daily (
  candidate_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  overall numeric(5,2) NOT NULL,
  per_pillar jsonb NOT NULL DEFAULT '{}'::jsonb,
  streak_day int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, snapshot_date)
) PARTITION BY RANGE (snapshot_date);

CREATE TABLE public.career_fitness_daily_2026_06 PARTITION OF public.career_fitness_daily
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE public.career_fitness_daily_2026_07 PARTITION OF public.career_fitness_daily
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE public.career_fitness_daily_2026_08 PARTITION OF public.career_fitness_daily
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE public.career_fitness_daily_2026_09 PARTITION OF public.career_fitness_daily
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE public.career_fitness_daily_default PARTITION OF public.career_fitness_daily DEFAULT;

GRANT SELECT, INSERT, UPDATE ON public.career_fitness_daily TO authenticated;
GRANT ALL ON public.career_fitness_daily TO service_role;
ALTER TABLE public.career_fitness_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fitness daily owner read" ON public.career_fitness_daily FOR SELECT TO authenticated
  USING (candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "fitness daily owner write" ON public.career_fitness_daily FOR ALL TO authenticated
  USING (candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid()) OR public.is_admin())
  WITH CHECK (candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid()) OR public.is_admin());

-- =========================================================
-- 4. Touch triggers
-- =========================================================
CREATE TRIGGER tg_pillars_touch BEFORE UPDATE ON public.practice_pillars FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER tg_subtopics_touch BEFORE UPDATE ON public.practice_subtopics FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER tg_prompts_touch BEFORE UPDATE ON public.practice_prompts FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER tg_items_touch BEFORE UPDATE ON public.practice_items FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER tg_workout_touch BEFORE UPDATE ON public.practice_daily_workout FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================
-- 5. Seed 12 pillars
-- =========================================================
INSERT INTO public.practice_pillars (slug, name, icon, color, sort_order, is_stream_aware) VALUES
  ('aptitude',       'Aptitude',                       '🧠', 'from-amber-500 to-orange-500',     10, false),
  ('reasoning',      'Logical Reasoning',              '🧩', 'from-violet-500 to-purple-500',    20, false),
  ('english',        'English & Vocabulary',           '📖', 'from-emerald-500 to-teal-500',     30, false),
  ('communication',  'Communication Practice',         '🎤', 'from-pink-500 to-rose-500',        40, false),
  ('confidence',     'Confidence & Speech',            '😊', 'from-yellow-500 to-amber-500',     50, false),
  ('hr',             'HR Interview',                   '💼', 'from-blue-500 to-indigo-500',      60, false),
  ('technical',      'Technical Interview',            '💻', 'from-sky-500 to-blue-500',         70, true),
  ('resume',         'Resume & ATS',                   '📝', 'from-fuchsia-500 to-pink-500',     80, false),
  ('soft_skills',    'Soft Skills & Workplace',        '🤝', 'from-lime-500 to-green-500',       90, false),
  ('ai_literacy',    'AI Literacy & Prompting',        '🤖', 'from-cyan-500 to-blue-500',       100, false),
  ('current_affairs','Current Affairs & Business',     '📅', 'from-orange-500 to-red-500',      110, false),
  ('mock_interview', 'Daily Mock Interview',           '🎥', 'from-purple-500 to-fuchsia-500',  120, true);
