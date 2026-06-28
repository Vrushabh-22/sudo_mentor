## Fix

The `practice_items.source` CHECK constraint only allows `'admin'` or `'llm'`, but the bulk-insert path sends `'excel'`, so all 20 rows fail.

**Migration**: drop and recreate the constraint to include `'excel'`:

```sql
alter table public.practice_items drop constraint practice_items_source_check;
alter table public.practice_items add constraint practice_items_source_check
  check (source = any (array['admin','llm','excel']));
```

No code changes needed — `practice-admin` already sends `source: 'excel'`.