// ── top-level catch: if the module itself fails to load, show it ──────────
window.addEventListener("error", (e) => {
  document.getElementById("loginError").textContent =
    "App failed to load: " + (e.message || e.type);
  document.getElementById("loginError").style.display = "block";
});

import { supabase } from "../config/supabase.js";

// ── State ─────────────────────────────────────────────────────────────────
let currentUser    = null;
let currentProfile = null;

// ── DOM refs ──────────────────────────────────────────────────────────────
let $loginScreen, $app, $loginError, $loginBtn, $logoutBtn;
let $email, $password, $userEmail;
let $adminPanel, $taskTitle, $taskNotes, $taskAssignee, $createTaskBtn;
let $taskList;

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Cache DOM
  $loginScreen   = document.getElementById("loginScreen");
  $app           = document.getElementById("app");
  $loginError    = document.getElementById("loginError");
  $loginBtn      = document.getElementById("loginBtn");
  $logoutBtn     = document.getElementById("logoutBtn");
  $email         = document.getElementById("email");
  $password      = document.getElementById("password");
  $userEmail     = document.getElementById("userEmail");
  $adminPanel    = document.getElementById("adminPanel");
  $taskTitle     = document.getElementById("taskTitle");
  $taskNotes     = document.getElementById("taskNotes");
  $taskAssignee  = document.getElementById("taskAssignee");
  $createTaskBtn = document.getElementById("createTaskBtn");
  $taskList      = document.getElementById("taskList");

  // Wire all events here — zero inline onclick attributes
  $loginBtn.addEventListener("click", handleLogin);
  $logoutBtn.addEventListener("click", handleLogout);
  $createTaskBtn.addEventListener("click", handleCreateTask);
  $email.addEventListener("keydown",    (e) => e.key === "Enter" && handleLogin());
  $password.addEventListener("keydown", (e) => e.key === "Enter" && handleLogin());

  // Restore existing session
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data?.session) {
      await bootUser(data.session.user);
    }
  } catch (err) {
    // Session check failing doesn't block login — just log it
    console.warn("Session restore failed:", err.message);
  }
});

// ── Login ─────────────────────────────────────────────────────────────────
async function handleLogin() {
  const email    = $email.value.trim().toLowerCase();
  const password = $password.value;

  hideError();

  if (!email || !password) {
    showError("Please enter your email and password.");
    return;
  }

  setLoginLoading(true);

  let data, error;

  try {
    ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
  } catch (err) {
    setLoginLoading(false);
    showError("Network error — could not reach the server. Check your connection.");
    console.error("signInWithPassword threw:", err);
    return;
  }

  setLoginLoading(false);

  if (error) {
    // Translate common Supabase error messages into plain English
    const msg = friendlyAuthError(error.message);
    showError(msg);
    return;
  }

  await bootUser(data.user);
}

function friendlyAuthError(raw) {
  if (!raw) return "Login failed. Please try again.";
  const r = raw.toLowerCase();
  if (r.includes("invalid login") || r.includes("invalid credentials"))
    return "Incorrect email or password.";
  if (r.includes("email not confirmed"))
    return "Please confirm your email address before signing in.";
  if (r.includes("too many requests"))
    return "Too many attempts. Please wait a moment and try again.";
  if (r.includes("network") || r.includes("fetch"))
    return "Network error — check your internet connection.";
  return raw; // fall back to raw message
}

function setLoginLoading(loading) {
  $loginBtn.disabled    = loading;
  $loginBtn.textContent = loading ? "Signing in…" : "Sign In";
}

// ── Logout ────────────────────────────────────────────────────────────────
async function handleLogout() {
  await supabase.auth.signOut().catch(() => {});
  currentUser    = null;
  currentProfile = null;
  showLoginScreen();
}

// ── Boot user ─────────────────────────────────────────────────────────────
async function bootUser(user) {
  currentUser = user;

  // Try to fetch profile — but don't block login if table doesn't exist yet
  let profile = { role: "user", full_name: null };

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    if (error) {
      // PGRST116 = no rows found; 42P01 = table doesn't exist
      if (error.code === "PGRST116") {
        console.warn("No profile row found for this user — using defaults.");
      } else if (error.message?.includes("does not exist")) {
        console.warn("profiles table not found — using defaults.");
      } else {
        console.error("Profile fetch error:", error.code, error.message);
      }
      // Proceed with defaults — do NOT block login
    } else {
      profile = data;
    }
  } catch (err) {
    console.warn("Profile fetch threw:", err.message);
  }

  currentProfile = profile;

  showAppScreen(profile.full_name || user.email);

  if (profile.role === "admin") {
    $adminPanel.style.display = "block";
    await loadAssignees();
  } else {
    $adminPanel.style.display = "none";
  }

  await loadTasks();
}

// ── Screen helpers ────────────────────────────────────────────────────────
function showLoginScreen() {
  $app.style.display         = "none";
  $loginScreen.style.display = "flex";
  $email.value               = "";
  $password.value            = "";
  hideError();
}

function showAppScreen(displayName) {
  $loginScreen.style.display = "none";
  $app.style.display         = "block";
  $userEmail.textContent     = displayName;
}

// ── Error helpers ─────────────────────────────────────────────────────────
function showError(msg) {
  $loginError.textContent   = msg;
  $loginError.style.display = "block";
}

function hideError() {
  $loginError.style.display = "none";
  $loginError.textContent   = "";
}

// ── Load tasks ────────────────────────────────────────────────────────────
async function loadTasks() {
  $taskList.innerHTML = `<p class="empty-state">Loading…</p>`;

  try {
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("*, assignee:profiles!assigned_to(full_name)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    renderTasks(tasks);
  } catch (err) {
    console.error("Tasks fetch failed:", err.message);
    $taskList.innerHTML = `<p class="empty-state">Could not load tasks: ${escapeHtml(err.message)}</p>`;
  }
}

// ── Render tasks ──────────────────────────────────────────────────────────
function renderTasks(tasks) {
  if (!tasks || tasks.length === 0) {
    $taskList.innerHTML = `<p class="empty-state">No tasks yet.</p>`;
    return;
  }

  $taskList.innerHTML = "";

  tasks.forEach((task) => {
    const isDone      = task.status === "done";
    const assignee    = task.assignee?.full_name || "Unassigned";
    const statusClass = isDone ? "status-done" : "status-pending";
    const statusLabel = isDone ? "Done" : "Pending";

    const card = document.createElement("div");
    card.className = "task-card";
    card.innerHTML = `
      <div class="task-header">
        <span class="task-title${isDone ? " done" : ""}">${escapeHtml(task.title)}</span>
        ${!isDone ? `<button class="btn-done" data-id="${task.id}">Mark Done</button>` : ""}
      </div>
      ${task.notes ? `<p class="task-notes">${escapeHtml(task.notes)}</p>` : ""}
      <div class="task-meta">
        <span class="task-status ${statusClass}">${statusLabel}</span>
        <span class="task-assignee">→ ${escapeHtml(assignee)}</span>
      </div>
    `;

    if (!isDone) {
      card.querySelector(".btn-done").addEventListener("click", () => handleMarkDone(task.id));
    }

    $taskList.appendChild(card);
  });
}

// ── Create task ───────────────────────────────────────────────────────────
async function handleCreateTask() {
  const title    = $taskTitle.value.trim();
  const notes    = $taskNotes.value.trim();
  const assignee = $taskAssignee.value || null;

  if (!title) {
    alert("Task title is required.");
    return;
  }

  $createTaskBtn.disabled    = true;
  $createTaskBtn.textContent = "Creating…";

  try {
    const { error } = await supabase.from("tasks").insert({
      title,
      notes:       notes || null,
      assigned_to: assignee,
      status:      "pending",
      created_by:  currentUser.id,
    });

    if (error) throw error;

    $taskTitle.value    = "";
    $taskNotes.value    = "";
    $taskAssignee.value = "";
    await loadTasks();
  } catch (err) {
    alert("Error creating task: " + err.message);
  }

  $createTaskBtn.disabled    = false;
  $createTaskBtn.textContent = "+ Create Task";
}

// ── Mark done ─────────────────────────────────────────────────────────────
async function handleMarkDone(taskId) {
  try {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done" })
      .eq("id", taskId);

    if (error) throw error;
    await loadTasks();
  } catch (err) {
    alert("Failed to update task: " + err.message);
  }
}

// ── Load assignees ────────────────────────────────────────────────────────
async function loadAssignees() {
  try {
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name");

    if (error) throw error;

    $taskAssignee.innerHTML = `<option value="">Assign to user (optional)</option>`;
    users.forEach((u) => {
      const opt       = document.createElement("option");
      opt.value       = u.id;
      opt.textContent = u.full_name || u.id;
      $taskAssignee.appendChild(opt);
    });
  } catch (err) {
    console.warn("Could not load assignees:", err.message);
  }
}

// ── XSS helper ────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
