import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CandidateTask {
  id: string;
  candidate_id: string;
  project_id: string | null;
  title: string;
  notes: string | null;
  status: 'todo' | 'in_progress' | 'done';
  due_on: string | null;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCandidateTasks(candidateId: string) {
  const [tasks, setTasks] = useState<CandidateTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!candidateId) return;
    const { data } = await supabase
      .from('candidate_project_tasks' as any)
      .select('*')
      .eq('candidate_id', candidateId)
      .order('status', { ascending: true })
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });
    setTasks((data as any) || []);
    setLoading(false);
  }, [candidateId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!candidateId) return;
    const channel = supabase
      .channel(`candidate_project_tasks_${candidateId}`)
      .on('postgres_changes' as any, {
        event: '*', schema: 'public', table: 'candidate_project_tasks',
        filter: `candidate_id=eq.${candidateId}`,
      }, () => { refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [candidateId, refresh]);

  const createTask = useCallback(async (input: { title: string; project_id?: string | null; due_on?: string | null }) => {
    if (!candidateId || !input.title.trim()) return;
    await supabase.from('candidate_project_tasks' as any).insert({
      candidate_id: candidateId,
      project_id: input.project_id || null,
      title: input.title.trim(),
      due_on: input.due_on || null,
      status: 'todo',
    });
    await refresh();
  }, [candidateId, refresh]);

  const updateTask = useCallback(async (id: string, patch: Partial<CandidateTask>) => {
    const p: any = { ...patch };
    if (patch.status === 'done' && !patch.completed_at) p.completed_at = new Date().toISOString();
    if (patch.status && patch.status !== 'done') p.completed_at = null;
    await supabase.from('candidate_project_tasks' as any).update(p).eq('id', id);
    await refresh();
  }, [refresh]);

  const deleteTask = useCallback(async (id: string) => {
    await supabase.from('candidate_project_tasks' as any).delete().eq('id', id);
    await refresh();
  }, [refresh]);

  return { tasks, loading, refresh, createTask, updateTask, deleteTask };
}
