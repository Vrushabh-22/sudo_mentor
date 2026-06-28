import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/sora/400.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import App from "./App";
import "./index.css";
import { supabase } from "@/integrations/supabase/client";

// Heal stale sessions: if the locally-stored session no longer exists on the
// auth server (e.g. project switch / user deleted), sign out so the user can
// re-authenticate instead of getting silent 401s from edge functions.
(async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    const code = (error as any)?.code || (error as any)?.name;
    const status = (error as any)?.status;
    if (error && (status === 403 || status === 401 || code === "session_not_found" || /session.*not.*found/i.test(error.message || ""))) {
      await supabase.auth.signOut().catch(() => {});
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
    }
    void data;
  } catch {}
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
