
CREATE OR REPLACE FUNCTION public.search_institutes(q text, lim int DEFAULT 8)
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  state text,
  country text,
  type text,
  usage_count integer,
  score real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (SELECT lower(trim(q)) AS ql)
  SELECT i.id, i.name, i.city, i.state, i.country, i.type, i.usage_count,
         GREATEST(
           similarity(lower(i.name), (SELECT ql FROM q)),
           COALESCE(
             (SELECT MAX(similarity(lower(a), (SELECT ql FROM q))) FROM unnest(i.aliases) AS a),
             0
           ),
           CASE WHEN lower(i.name) LIKE '%' || (SELECT ql FROM q) || '%' THEN 0.5 ELSE 0 END,
           CASE WHEN EXISTS (SELECT 1 FROM unnest(i.aliases) AS a WHERE lower(a) LIKE '%' || (SELECT ql FROM q) || '%') THEN 0.5 ELSE 0 END
         )::real AS score
  FROM public.institutes i
  WHERE lower(i.name) LIKE '%' || (SELECT ql FROM q) || '%'
     OR EXISTS (SELECT 1 FROM unnest(i.aliases) AS a WHERE lower(a) LIKE '%' || (SELECT ql FROM q) || '%')
     OR similarity(lower(i.name), (SELECT ql FROM q)) > 0.3
  ORDER BY score DESC, usage_count DESC, name ASC
  LIMIT lim;
$$;

REVOKE ALL ON FUNCTION public.search_institutes(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_institutes(text, int) TO authenticated, service_role;
