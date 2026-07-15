import { supabase } from "./supabase-client.js?v=5";

// Redirect targets must also be added to the Supabase project's Auth > URL Configuration >
// Redirect URLs allow-list, or Supabase silently falls back to the dashboard's default Site
// URL instead of this. Using the current page's own URL means this adapts automatically
// between local dev and the deployed GitHub Pages origin — no hardcoded domain here.
function currentPageUrl() {
  return window.location.origin + window.location.pathname;
}

export async function signInWithPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
}

export async function signInWithMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: currentPageUrl() },
  });
  return { error };
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: currentPageUrl() },
  });
  return { data, error };
}

// Writes the display name + Instagram handle collected right after signup.
export async function createProfile(userId, name, instagramHandle) {
  const { error } = await supabase.from("profiles").insert({
    id: userId,
    name,
    instagram_handle: instagramHandle,
  });
  return { error };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "login.html";
}
