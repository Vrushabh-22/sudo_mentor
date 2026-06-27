import { supabase } from "@/integrations/supabase/client";

export async function getCandidateToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function getCandidateTokenSync(): string | null {
  return null;
}
