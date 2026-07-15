import { supabase } from "./supabase-client.js?v=4";

export async function signInWithPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
}

export async function signInWithMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  return { error };
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
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
