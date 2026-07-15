import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../config.js?v=3";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Redirects to login.html if there is no active session. Call on every protected page.
// This is a UX courtesy only — Row Level Security in supabase/schema.sql is the real gate.
export async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}
