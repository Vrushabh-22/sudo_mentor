import { SUPABASE_URL } from "@/integrations/supabase/client";

export function getStorageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SUPABASE_URL}${path}`;
}

export function stripStorageDomain(fullUrl: string): string {
  try {
    const url = new URL(fullUrl);
    return url.pathname;
  } catch {
    return fullUrl;
  }
}
