import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, PlusCircle } from 'lucide-react';

type Item = {
  id?: string;
  name: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  type?: string | null;
  suggested?: boolean;
};

interface Props {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
}

export function InstituteAutocomplete({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const lastFetched = useRef<string>('');

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setItems([]); setLoading(false); return; }
    if (q === lastFetched.current) return;
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      lastFetched.current = q;
      const { data, error } = await supabase.functions.invoke('institute-search', { body: { q, limit: 8 } });
      if (!error && data?.items) {
        setItems(data.items as Item[]);
        setHighlight(0);
      } else {
        setItems([]);
      }
      setLoading(false);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function pick(name: string) {
    onChange(name);
    setQuery(name);
    setOpen(false);
  }

  const showAdd = query.trim().length >= 2 && !items.some((i) => i.name.toLowerCase() === query.trim().toLowerCase());
  const total = items.length + (showAdd ? 1 : 0);

  return (
    <div className="relative" ref={boxRef}>
      <Input
        className="h-9 text-sm"
        placeholder={placeholder || 'Start typing your college…'}
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(total - 1, h + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); }
          else if (e.key === 'Enter') {
            if (highlight < items.length) { e.preventDefault(); pick(items[highlight].name); }
            else if (showAdd) { e.preventDefault(); pick(query.trim()); }
          } else if (e.key === 'Escape') { setOpen(false); }
        }}
        autoComplete="off"
      />
      {open && (query.trim().length >= 2) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-auto">
          {loading && items.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching…
            </div>
          )}
          {items.map((it, idx) => {
            const isSuggested = it.suggested;
            const active = idx === highlight;
            return (
              <button
                key={(it.id || it.name) + idx}
                type="button"
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => pick(it.name)}
                className={`w-full text-left px-3 py-2 text-sm flex items-start gap-2 ${active ? 'bg-violet-50' : 'hover:bg-slate-50'}`}
              >
                {isSuggested && <Sparkles className="h-3.5 w-3.5 text-violet-500 mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-slate-900">{it.name}</div>
                  {(it.city || it.state) && (
                    <div className="text-[11px] text-slate-500 truncate">
                      {[it.city, it.state, it.country].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
                {isSuggested && <span className="text-[10px] text-violet-600 font-medium mt-0.5">AI</span>}
              </button>
            );
          })}
          {showAdd && (
            <button
              type="button"
              onMouseEnter={() => setHighlight(items.length)}
              onClick={() => pick(query.trim())}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 border-t border-slate-100 ${highlight === items.length ? 'bg-violet-50' : 'hover:bg-slate-50'}`}
            >
              <PlusCircle className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-700">Use "<span className="font-medium">{query.trim()}</span>"</span>
            </button>
          )}
          {!loading && items.length === 0 && !showAdd && (
            <div className="px-3 py-2 text-xs text-slate-500">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}
