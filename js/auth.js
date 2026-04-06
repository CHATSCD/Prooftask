import { supabase } from "./config/supabase.js";

// ============================
// INIT (auto login if session exists)
// ============================
document.addEventListener("DOMContentLoaded", async () => {
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    handleUser(data.session.user);
  }
});

// ============================
// LOGIN
// ============================
window.login = async function () {
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Enter email and password");
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error("LOGIN ERROR:", error);
    alert("Login failed: " + error.message);
    return;
  }

  handleUser(data.user);
};

// ============================
// HANDLE USER AFTER LOGIN
// ============================
async function handleUser(user) {
  console.log("User logged in:", user);

  // Get profile (role)
  const { data: profile, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("PROFILE ERROR:", error);
    alert("Error loading user profile");
    return;
  }

  // Hide login, show app
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display = "block";

  // Show admin panel if admin
  if (profile.role === "admin") {
    document.getElementById("adminPanel").style.display = "block";
  } else {
    document.getElementById("adminPanel").style.display = "none";
  }
}

// ============================
// LOGOUT
// ============================
window.logout = async function () {
  await supabase.auth.signOut();

  document.getElementById("loginScreen").style.display = "block";
  document.getElementById("app").style.display = "none";
};
