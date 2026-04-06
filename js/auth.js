// ============================
// AUTH SYSTEM (PRODUCTION)
// ============================

import { supabase } from "../config/supabase.js";

// ----------------------------
// GET CURRENT SESSION
// ----------------------------
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Session error:", error.message);
    return null;
  }
  return data.session;
}

// ----------------------------
// SIGN UP
// ----------------------------
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password: password.trim()
  });

  if (error) {
    alert("Signup error: " + error.message);
    return null;
  }

  alert("User created. You can now log in.");
  return data;
}

// ----------------------------
// SIGN IN
// ----------------------------
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: password.trim()
  });

  if (error) {
    alert("Login failed: " + error.message);
    return null;
  }

  return data;
}

// ----------------------------
// SIGN OUT
// ----------------------------
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Logout error:", error.message);
  }

  location.reload();
}

// ----------------------------
// GET USER PROFILE (ROLE)
// ----------------------------
export async function getProfile() {
  const session = await getSession();
  if (!session) return null;

  const userId = session.user.id;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Profile error:", error.message);
    return null;
  }

  return data;
}

// ----------------------------
// REQUIRE AUTH (AUTO REDIRECT)
// ----------------------------
export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    window.location.href = "/login.html";
    return null;
  }

  return session;
}

// ----------------------------
// INIT AUTH (AUTO LOAD)
// ----------------------------
export async function initAuth() {
  const session = await getSession();

  if (!session) {
    console.log("Not logged in");
    return null;
  }

  const profile = await getProfile();

  if (!profile) {
    console.log("No profile found");
    return null;
  }

  console.log("Logged in as:", profile);

  // 🔥 ROLE HANDLING
  if (profile.role === "admin") {
    document.body.classList.add("admin");
    showAdminUI();
  } else {
    document.body.classList.add("worker");
    showWorkerUI();
  }

  return profile;
}

// ----------------------------
// UI HELPERS (YOU CAN EDIT)
// ----------------------------
function showAdminUI() {
  const el = document.getElementById("adminPanel");
  if (el) el.style.display = "block";
}

function showWorkerUI() {
  const el = document.getElementById("workerPanel");
  if (el) el.style.display = "block";
}
