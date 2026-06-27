import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Note {
  id: string;
  candidate_id: string;
  tenant_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  content: any;
  kind: 'page' | 'daily';
  daily_date: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

export function useNotes(candidateId: string, tenantId?: string | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!candidateId) return;
    const { data } = await supabase
      .from('candidate_notes' as any)
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('is_archived', false)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    setNotes((data as any) || []);
    setLoading(false);
  }, [candidateId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!candidateId) return;
    const channel = supabase
      .channel(`candidate_notes_${candidateId}`)
      .on('postgres_changes' as any, {
        event: '*', schema: 'public', table: 'candidate_notes',
        filter: `candidate_id=eq.${candidateId}`,
      }, () => { refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [candidateId, refresh]);

  const createPage = useCallback(async (overrides: Partial<Note> = {}) => {
    const payload: any = {
      candidate_id: candidateId,
      tenant_id: tenantId || null,
      title: overrides.title || 'Untitled',
      icon: overrides.icon || '📝',
      content: overrides.content || EMPTY_DOC,
      kind: overrides.kind || 'page',
      daily_date: overrides.daily_date || null,
    };
    const { data, error } = await supabase
      .from('candidate_notes' as any)
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    await refresh();
    return data as unknown as Note;
  }, [candidateId, tenantId, refresh]);

  const getOrCreateDaily = useCallback(async (dateISO: string) => {
    const existing = notes.find(n => n.kind === 'daily' && n.daily_date === dateISO);
    if (existing) return existing;
    const { data } = await supabase
      .from('candidate_notes' as any)
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('kind', 'daily')
      .eq('daily_date', dateISO)
      .maybeSingle();
    if (data) return data as unknown as Note;
    const d = new Date(dateISO + 'T00:00:00');
    const title = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    return createPage({ kind: 'daily', daily_date: dateISO, title, icon: '🗓️' });
  }, [notes, candidateId, createPage]);

  const updateNote = useCallback(async (id: string, patch: Partial<Note>) => {
    const { error } = await supabase
      .from('candidate_notes' as any)
      .update(patch as any)
      .eq('id', id);
    if (error) throw error;
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch } as Note : n));
  }, []);

  const archiveNote = useCallback(async (id: string) => {
    await supabase.from('candidate_notes' as any).update({ is_archived: true }).eq('id', id);
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const togglePin = useCallback(async (id: string, value: boolean) => {
    await updateNote(id, { is_pinned: value });
  }, [updateNote]);

  const pinned = useMemo(() => notes.filter(n => n.is_pinned && n.kind === 'page'), [notes]);
  const dailies = useMemo(() => notes.filter(n => n.kind === 'daily').sort((a, b) => (b.daily_date || '').localeCompare(a.daily_date || '')), [notes]);
  const pages = useMemo(() => notes.filter(n => n.kind === 'page'), [notes]);

  return { notes, pinned, dailies, pages, loading, createPage, getOrCreateDaily, updateNote, archiveNote, togglePin, refresh };
}
