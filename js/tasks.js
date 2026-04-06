import { supabase } from "../config/supabase.js";

export async function fetchTasks() {
  const { data, error } = await supabase.from("tasks").select("*");
  if (error) { console.error(error); return []; }
  return data;
}
