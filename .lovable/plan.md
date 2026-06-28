## Goal

Remove the LLM Prompt Studio from the Practice Content admin entirely. Replace it with a simple, template-driven **Question Bank** flow per subtopic (like the `Questions` module in `lovable-hiring-hub-02`): admin picks **question type + counts** on a subtopic, downloads an Excel template for that type, fills it offline, uploads it, and the rows land in `practice_items` as approved items ready for the daily workout.

No prompts. No LLM generation in admin. Daily workout keeps reading from `practice_items`.

## Subtopic config (replaces "Kind + Time budget")

For each subtopic, admin sets:
- **Question types enabled** (multi-select, drives which templates can be uploaded):
  - `mcq` — single/multiple choice (Choice1–6, RightChoices)
  - `true_false`
  - `fill_blanks` (Answer1–5)
  - `subjective` (ScoringCriteria)
  - `speech` (ReferenceText, TimeLimit)
  - `scenario` (situational MCQ; same shape as mcq with longer stem)
  - `ordering` (Item1–10, ScoringMode)
- **Target counts per type** (e.g. mcq: 50, speech: 10) — informational + progress bar against current approved item count.
- **Default difficulty** (easy/medium/hard) and **time budget (s)** — kept.
- **Stream-aware** flag — kept (already on pillar).

The existing `practice_items` table already supports `kind`, `payload`, `difficulty`, `status`, `stream_tag`, so no schema change needed for storage. We'll only:
- Add `practice_subtopics.enabled_kinds text[]` and `target_counts jsonb` (e.g. `{"mcq":50,"speech":10}`).
- Keep `default_kind` for backward compat; ignore in new UI.

## New admin UI (right pane, replaces Prompt Studio)

Three sections per selected subtopic:

1. **Question types** card
   - Checkbox grid of supported kinds with a numeric input for target count.
   - Save button persists `enabled_kinds` + `target_counts`.

2. **Upload questions** card (the core "smart-assessment" parity piece)
   - Dropdown: question type (only enabled kinds).
   - **Download template** button → generates an `.xlsx` with the exact headers + 1 example row for that type, using the same column conventions as `ExcelQBUploadDialog` (MCQ: QuestionText, Choice1..Choice6, RightChoices, IsMultipleRightChoice, Difficulty; Speech: QuestionText, ReferenceText, TimeLimit, Difficulty; etc.). Generated client-side with `xlsx`.
   - **Upload .xlsx** → parsed client-side with `xlsx`, auto-detects format from headers (same logic as ref), validates each row, shows a preview table with valid/invalid badges and per-row errors. Admin can deselect bad rows, then **Import** sends valid rows in batches to the edge function.

3. **Item bank** card (same as today but read-only-ish)
   - Filters: type, status (approved/draft), difficulty.
   - Inline edit / delete / toggle status. No "approve" needed for Excel-imported rows — they import as `approved` by default (admin can toggle to draft).
   - Counts per type vs target, with a progress bar.

The left two columns (Pillars list, Subtopics list) stay as they are.

## Backend changes

- New migration adds `enabled_kinds text[] not null default '{}'` and `target_counts jsonb not null default '{}'` to `practice_subtopics`. No table creation.
- Extend `practice-admin` edge function with one new action:
  - `bulk_insert_items` — accepts `{ subtopic_id, kind, items: [{payload, difficulty, stream_tag}], status: 'approved'|'draft' }`. Inserts in chunks of 200 via service-role client. Returns inserted/failed counts.
- Remove `generate_sample` action and the `practice_prompts` references from the admin UI (the table can stay in DB for now; we just stop using it from the admin tab). No edge function changes for `practice-workout`.

## Files to add / edit

**Edit**
- `supabase/migrations/<new>.sql` — add columns above with grants already covered (table already has them).
- `supabase/functions/practice-admin/index.ts` — add `bulk_insert_items`; keep CRUD for items.
- `src/lib/practiceClient.ts` — no change (uses generic invoke).
- `src/components/admin/PracticeContentSettings.tsx` — replace right pane: remove Prompt Studio, add the three sections above.

**Add**
- `src/components/admin/practice/QuestionTemplates.ts` — per-kind header definitions + example row + Excel generator (xlsx).
- `src/components/admin/practice/QuestionExcelParser.ts` — detect format from headers, parse + validate rows per kind (ported/trimmed from `ExcelQBUploadDialog`).
- `src/components/admin/practice/QuestionUploadCard.tsx` — download template / file drop / preview table / import.
- `src/components/admin/practice/QuestionTypesCard.tsx` — enabled kinds + target counts editor.
- `src/components/admin/practice/ItemBankCard.tsx` — item list with filters + inline actions.

**Dependency**
- Add `xlsx` to `package.json` (used both for template generation and parsing).

## Technical notes

- Templates and parsing live entirely client-side; no AI call path is touched.
- `practice_items.payload` schema per kind stays compatible with `practice-workout` runner (mcq: `{question, options, correct_index, explanation}`; speech: `{prompt, reference_text, time_limit}`; etc.). The parser normalizes Excel rows into these shapes before sending to `bulk_insert_items`.
- `RightChoices` in MCQ accepts either the option text or a 1-based index list (`"1,3"`) — same as ref project — and is converted to `correct_index` (single) or `correct_indices` (multiple) in the payload.
- All inserts route through the service-role admin function (no direct table writes from the browser), preserving the existing RLS posture.
- The old `practice_prompts` table and `generate_sample` code are not deleted in this pass — they're just unreferenced — so we can drop them in a later cleanup once we confirm nothing depends on them.
