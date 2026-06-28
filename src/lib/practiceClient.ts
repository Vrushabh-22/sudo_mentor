import { supabase } from "@/integrations/supabase/client";

export async function practiceAdmin<T = any>(body: Record<string, any>): Promise<{ data: T | null; error: any }> {
  const { data, error } = await supabase.functions.invoke("practice-admin", { body });
  if (error) return { data: null, error };
  if (data && data.error) return { data: null, error: new Error(data.error) };
  return { data: data as T, error: null };
}

export async function practiceWorkout<T = any>(body: Record<string, any>): Promise<{ data: T | null; error: any }> {
  const { data, error } = await supabase.functions.invoke("practice-workout", { body });
  if (error) return { data: null, error };
  if (data && data.error) return { data: null, error: new Error(data.error) };
  return { data: data as T, error: null };
}
