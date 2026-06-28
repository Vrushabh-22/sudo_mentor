## Goal
Refactor `/admin` → Settings from a single long-scroll page into a **vertical sidebar layout** with two sections, loading only the active one to avoid extra DB/edge-function calls.

## Changes (UI only — no behavior changes)

1. **`src/components/admin/AdminSettings.tsx`** — replace current layout with a two-column grid:
   - Left: vertical menu (Tailwind list, ~220px), items: **LLM Providers**, **Azure Storage**. Active item highlighted with `bg-muted` + left accent bar.
   - Right: renders only the selected section component.
   - State: `useState<"llm" | "azure">("llm")`. Each section is its own component, mounted lazily so its `load()` only runs when selected (i.e. conditional render, not just hidden).
   - Remove the Google OAuth and Branding cards entirely.

2. **Extract `LlmProviderSettings.tsx`** — move the existing LLM provider card + API key pool card + Add-key dialog out of `AdminSettings.tsx` into a new file `src/components/admin/LlmProviderSettings.tsx`. Pure cut/paste of existing logic — no functional changes.

3. **`AzureStorageSettings.tsx`** — already exists, unchanged.

4. Drop unused imports (`Switch` for app-settings, etc.) after removing OAuth/Branding.

No DB, edge function, or route changes.

## Resulting structure
```text
Settings
├── [LLM Providers]   ← default
│     - Active provider card
│     - API key pool card
└── [Azure Storage]
      - Account card
      - Container mappings card
```

Switching sections unmounts the previous one so its data isn't kept in memory; first click on a section triggers its `load()`.