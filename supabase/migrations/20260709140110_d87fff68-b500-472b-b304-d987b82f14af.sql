
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.institutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  city text,
  state text,
  country text NOT NULL DEFAULT 'India',
  type text,
  source text NOT NULL DEFAULT 'seed',
  verified boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX institutes_name_country_key ON public.institutes (lower(name), country);
CREATE INDEX institutes_name_trgm ON public.institutes USING gin (name gin_trgm_ops);
CREATE INDEX institutes_aliases_gin ON public.institutes USING gin (aliases);

GRANT SELECT ON public.institutes TO authenticated;
GRANT ALL ON public.institutes TO service_role;

ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read institutes" ON public.institutes
  FOR SELECT TO authenticated USING (true);
