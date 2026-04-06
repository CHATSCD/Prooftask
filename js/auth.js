import { supabase } from "../config/supabase.js";

export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { alert(error.message); return null; }
  return data.user;
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}
