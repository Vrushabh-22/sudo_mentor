import { useCallback, useEffect, useState } from 'react';
import { invokeV4 } from '@/lib/candidatePortalV4Client';

export interface MyProject {
  id: string;
  company_name: string;
  company_logo_url?: string;
  title: string;
  duration_hours: number;
  difficulty: string;
  tech_stack: string[];
  tags: string[];
  problem_statement?: string;
  my_submission?: {
    id: string;
    status: string;
    submitted_at?: string;
    candidate_project_evaluations?: { overall_score: number }[];
  } | null;
}

export function useMyProjects() {
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await invokeV4({ action: 'list_projects' });
    setProjects(((data as any)?.projects || []) as MyProject[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const mine = projects.filter(p => !!p.my_submission);
  const available = projects.filter(p => !p.my_submission);

  return { projects, mine, available, loading, refresh };
}
