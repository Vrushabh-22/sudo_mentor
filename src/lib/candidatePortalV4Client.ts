import { supabase } from "@/integrations/supabase/client";

const SESSION_CANDIDATE_KEY = "candidate_session_user";

export async function invokeV4<T = any>(body: Record<string, any>): Promise<{ data: T | null; error: any }> {
  let candidateId: string | undefined;
  let tenantId: string | undefined;
  try {
    const raw = sessionStorage.getItem(SESSION_CANDIDATE_KEY);
    if (raw) {
      const u = JSON.parse(raw);
      if (u?.candidateId && u?.tenantId) {
        candidateId = u.candidateId;
        tenantId = u.tenantId;
      }
    }
  } catch {}

  const merged = {
    ...body,
    ...(candidateId && tenantId ? { candidateId, tenantId } : {}),
  };

  const { data, error } = await supabase.functions.invoke("candidate-portal-v4-api", { body: merged });
  return { data: data as T | null, error };
}
