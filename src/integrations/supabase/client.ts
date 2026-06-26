import { createClient } from "@supabase/supabase-js";

// Database type lives in the source ATS project's generated types — the candidate
// portal only needs runtime access, so we type the client loosely here.
type Database = any;

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Set them in .env."
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
