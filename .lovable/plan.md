
# Institute autocomplete for the profile setup

Replace the free-text "College name" input in `ProfileFormCard` with a typeahead that suggests real institute names. Use a **hybrid** source: a database table of known institutes (fast, deterministic, cheap) with an **LLM fallback** for queries that don't match — accepted picks are written back to the table so the list grows over time.

Pure-LLM on every keystroke would be slow, expensive, and prone to hallucinated colleges. Pure static list would miss long-tail institutes. Hybrid gives us both.

## Data flow

```text
User types "iit b"
   │
   ▼
Debounce 250ms → edge function `institute-search?q=iit b`
   │
   ├─ pg_trgm search on public.institutes  → 8 matches → return
   │
   └─ if 0 matches AND q.length ≥ 4:
         call Lovable AI (google/gemini-3-flash-preview) with a strict
         JSON schema asking for up to 5 real institutes matching q
         → validate → upsert into public.institutes with source='llm', verified=false
         → return them tagged {suggested:true}
```

On the client, show DB matches first, then a divider "Suggested — tap to add", then LLM suggestions. Selecting a suggested one flips `verified=true`. If nothing fits, an "Add my institute" row lets the user submit exactly what they typed (stored `verified=false, source='user'`).

## Database (new migration)

```sql
CREATE TABLE public.institutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  city text,
  state text,
  country text NOT NULL DEFAULT 'India',
  type text,                   -- 'university' | 'college' | 'iit' | 'nit' | 'iiit' | ...
  source text NOT NULL DEFAULT 'seed', -- 'seed' | 'llm' | 'user'
  verified boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX institutes_name_country_key ON public.institutes (lower(name), country);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX institutes_name_trgm ON public.institutes USING gin (name gin_trgm_ops);
CREATE INDEX institutes_aliases_gin ON public.institutes USING gin (aliases);

GRANT SELECT ON public.institutes TO authenticated;
GRANT ALL ON public.institutes TO service_role;

ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read institutes" ON public.institutes FOR SELECT TO authenticated USING (true);
-- writes only via edge function (service role bypasses RLS)
```

Seed with a curated CSV of ~200 top Indian institutes (IITs, NITs, IIITs, top private universities) so day-one UX is decent — no need to bulk-load AICTE's full list.

## Edge function `institute-search`

- `GET /institute-search?q=<text>&limit=8`
- JWT-guarded (verify token; only issued to logged-in candidates).
- Query pg_trgm on `name` + array match on `aliases`, ordered by `similarity DESC, usage_count DESC`.
- If 0 rows and `q.length >= 4`, call Lovable AI with structured output:
  ```
  { institutes: [{ name, city?, state?, country?, type? }] }
  ```
  Prompt: "Return up to 5 real, currently-operating higher-education institutes matching the query. If uncertain, return fewer."
- Upsert results (`source='llm'`, `verified=false`) via service role. Return combined list with a `suggested` flag.
- On any successful profile save that includes an institute, increment `usage_count` (separate edge action or DB trigger).

Rate-limit LLM branch: max 20 LLM calls / user / hour (in-memory `Map` keyed by `user_id` with a rolling window is enough for v1).

## Web changes

### `src/components/candidate/v4/chat/InstituteAutocomplete.tsx` (new)
- Controlled component `{ value, onChange(name, id?) }`.
- Uses shadcn `Command` + `Popover` (already in project) for the dropdown.
- Debounced fetch (250ms) via `supabase.functions.invoke('institute-search', { body: { q } })`.
- States: loading, results (with `suggested` divider), empty → "Add \"<q>\"" row.
- Keyboard nav (↑/↓/Enter), shows city/state as secondary text.

### `src/components/candidate/v4/chat/ProfileFormCard.tsx`
Swap the plain `Input` at line 76 for `<InstituteAutocomplete value={vals.institution || ''} onChange={(v) => set('institution', v)} />`. No other changes.

### Optional: also swap the same field on `CandidateAuth` signup if the institute question appears there — I didn't find it, so out of scope unless you point me at it.

## Cost / UX notes

- DB hit is < 30 ms and free. Only unseen queries reach the LLM.
- One LLM call ~ 200 output tokens on `google/gemini-3-flash-preview` — fractions of a cent.
- No autocomplete-on-every-keystroke to LLM — DB is always tried first.
- Suggestions get written back, so popular missing institutes stop hitting the LLM after the first user finds them.

## Out of scope
- Bulk import of AICTE/UGC master list (can be a follow-up migration once we know we need it).
- Admin UI to verify `source='llm'/'user'` rows.
- Global (non-India) coverage beyond what the LLM returns opportunistically.
