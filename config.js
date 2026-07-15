// config.js — safe to commit. Supabase's publishable key (sb_publishable_...) is designed to
// be public in client-side code, same role the old "anon key" played. Security comes from
// Row Level Security policies in supabase/schema.sql, not from keeping this key secret.

export const SUPABASE_URL = "https://putenyuqtftidxtslcwl.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_yYjrFuEPVDwxXxUD5SwibA_b_MC5MwM";
