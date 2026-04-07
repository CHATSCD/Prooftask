// ── top-level catch: surface module-load failures visibly ─────────────────
window.addEventListener("error", (e) => {
  const box = document.getElementById("loginError");
  if (box) { box.textContent = "App error: " + (e.message || e.type); box.style.display = "block"; }
});

import { supabase, SUPABASE_URL, SUPABASE_ANON } from "../config/supabase.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Hardwired super-admins ────────────────────────────────────────────────
// These emails ALWAYS get admin access, regardless of the database.
// Add more emails here to grant permanent admin access.
const SUPER_ADMINS = [
  "shauncdubuisson@gmail.com",
];

// ── State ─────────────────────────────────────────────────────────────────
let currentUser    = null;
let currentProfile = null;

// ── DOM refs ──────────────────────────────────────────────────────────────
let $loginScreen, $app, $loginError, $loginSuccess;
let $tabSignIn, $tabSignUp, $formSignIn, $formSignUp;
let $loginBtn, $registerBtn, $logoutBtn;
let $email, $password, $regName, $regEmail, $regPassword;
let $userEmail, $adminPanel, $userMgmtPanel;
let $taskTitle, $taskNotes, $taskAssignee, $createTaskBtn;
let $taskList, $userList;
let $newUserName, $newUserEmail, $newUserPassword, $newUserRole, $addUserBtn, $addUserMsg;

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Cache DOM
  $loginScreen  = document.getElementById("loginScreen");
  $app          = document.getElementById("app");
  $loginError   = document.getElementById("loginError");
  $loginSuccess = document.getElementById("loginSuccess");
  $tabSignIn    = document.getElementById("tabSignIn");
  $tabSignUp    = document.getElementById("tabSignUp");
  $formSignIn   = document.getElementById("formSignIn");
  $formSignUp   = document.getElementById("formSignUp");
  $loginBtn     = document.getElementById("loginBtn");
  $registerBtn  = document.getElementById("registerBtn");
  $logoutBtn    = document.getElementById("logoutBtn");
  $email        = document.getElementById("email");
  $password     = document.getElementById("password");
  $regName      = document.getElementById("regName");
  $regEmail     = document.getElementById("regEmail");
  $regPassword  = document.getElementById("regPassword");
  $userEmail    = document.getElementById("userEmail");
  $adminPanel   = document.getElementById("adminPanel");
  $userMgmtPanel = document.getElementById("userMgmtPanel");
  $taskTitle    = document.getElementById("taskTitle");
  $taskNotes    = document.getElementById("taskNotes");
  $taskAssignee = document.getElementById("taskAssignee");
  $createTaskBtn = document.getElementById("createTaskBtn");
  $taskList      = document.getElementById("taskList");
  $userList      = document.getElementById("userList");
  $newUserName   = document.getElementById("newUserName");
  $newUserEmail  = document.getElementById("newUserEmail");
  $newUserPassword = document.getElementById("newUserPassword");
  $newUserRole   = document.getElementById("newUserRole");
  $addUserBtn    = document.getElementById("addUserBtn");
  $addUserMsg    = document.getElementById("addUserMsg");

  // Tab switching
  $tabSignIn.addEventListener("click", () => switchTab("signin"));
  $tabSignUp.addEventListener("click", () => switchTab("signup"));

  // Button events
  $loginBtn.addEventListener("click", handleLogin);
  $registerBtn.addEventListener("click", handleRegister);
  $logoutBtn.addEventListener("click", handleLogout);
  $createTaskBtn.addEventListener("click", handleCreateTask);
  $addUserBtn.addEventListener("click", handleAddUser);

  // Enter key on sign-in fields
  $email.addEventListener("keydown",    (e) => e.key === "Enter" && handleLogin());
  $password.addEventListener("keydown", (e) => e.key === "Enter" && handleLogin());

  // Restore session
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) await bootUser(data.session.user);
  } catch (err) {
    console.warn("Session restore failed:", err.message);
  }
});

// ── Tab switching ─────────────────────────────────────────────────────────
function switchTab(tab) {
  hideMessages();
  if (tab === "signin") {
    $tabSignIn.classList.add("active");
    $tabSignUp.classList.remove("active");
    $formSignIn.style.display = "block";
    $formSignUp.style.display = "none";
  } else {
    $tabSignUp.classList.add("active");
    $tabSignIn.classList.remove("active");
    $formSignUp.style.display = "block";
    $formSignIn.style.display = "none";
  }
}

// ── Login ─────────────────────────────────────────────────────────────────
async function handleLogin() {
  const email    = $email.value.trim().toLowerCase();
  const password = $password.value;
  hideMessages();

  if (!email || !password) { showError("Please enter your email and password."); return; }

  setLoading($loginBtn, true, "Signing in…", "Sign In");

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await bootUser(data.user);
  } catch (err) {
    showError(friendlyAuthError(err.message));
  }

  setLoading($loginBtn, false, "Signing in…", "Sign In");
}

// ── Register ──────────────────────────────────────────────────────────────
async function handleRegister() {
  const name     = $regName.value.trim();
  const email    = $regEmail.value.trim().toLowerCase();
  const password = $regPassword.value;
  hideMessages();

  if (!name)                        { showError("Please enter your full name."); return; }
  if (!email)                       { showError("Please enter your email."); return; }
  if (password.length < 6)          { showError("Password must be at least 6 characters."); return; }

  setLoading($registerBtn, true, "Creating account…", "Create Account");

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // Create a profile row for this user
    if (data.user) {
      await supabase.from("profiles").upsert({
        id:        data.user.id,
        full_name: name,
        role:      "user",
      });
    }

    showSuccess("Account created! Check your email to confirm, then sign in.");
    $regName.value = $regEmail.value = $regPassword.value = "";
    switchTab("signin");
  } catch (err) {
    showError(friendlyAuthError(err.message));
  }

  setLoading($registerBtn, false, "Creating account…", "Create Account");
}

// ── Logout ────────────────────────────────────────────────────────────────
async function handleLogout() {
  await supabase.auth.signOut().catch(() => {});
  currentUser = currentProfile = null;
  showLoginScreen();
}

// ── Boot user ─────────────────────────────────────────────────────────────
async function bootUser(user) {
  currentUser = user;

  // Check if this is a hardwired super-admin
  const isSuperAdmin = SUPER_ADMINS.includes(user.email?.toLowerCase());

  // Fetch profile from DB
  let profile = { role: isSuperAdmin ? "admin" : "user", full_name: null };

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.warn("Profile fetch:", error.message);
    } else if (data) {
      // Super-admin overrides DB role
      profile = { ...data, role: isSuperAdmin ? "admin" : data.role };
    }
  } catch (err) {
    console.warn("Profile fetch threw:", err.message);
  }

  // If super-admin has no profile row yet, create one automatically
  if (isSuperAdmin) {
    await supabase.from("profiles").upsert({
      id:        user.id,
      full_name: profile.full_name || user.email,
      role:      "admin",
    });
  }

  currentProfile = profile;
  showAppScreen(profile.full_name || user.email);

  const isAdmin = profile.role === "admin";
  $adminPanel.style.display    = isAdmin ? "block" : "none";
  $userMgmtPanel.style.display = isAdmin ? "block" : "none";

  if (isAdmin) {
    await Promise.all([loadAssignees(), loadUserManagement()]);
  }

  await loadTasks();
}

// ── Screen helpers ────────────────────────────────────────────────────────
function showLoginScreen() {
  $app.style.display         = "none";
  $loginScreen.style.display = "flex";
  $email.value = $password.value = "";
  hideMessages();
}

function showAppScreen(displayName) {
  $loginScreen.style.display = "none";
  $app.style.display         = "block";
  $userEmail.textContent     = displayName;
}

// ── Message helpers ───────────────────────────────────────────────────────
function showError(msg) {
  $loginError.textContent   = msg;
  $loginError.style.display = "block";
  $loginSuccess.style.display = "none";
}

function showSuccess(msg) {
  $loginSuccess.textContent   = msg;
  $loginSuccess.style.display = "block";
  $loginError.style.display   = "none";
}

function hideMessages() {
  $loginError.style.display   = "none";
  $loginSuccess.style.display = "none";
}

function setLoading(btn, loading, loadingText, defaultText) {
  btn.disabled    = loading;
  btn.textContent = loading ? loadingText : defaultText;
}

function friendlyAuthError(raw) {
  if (!raw) return "Something went wrong. Please try again.";
  const r = raw.toLowerCase();
  if (r.includes("invalid login") || r.includes("invalid credentials")) return "Incorrect email or password.";
  if (r.includes("email not confirmed")) return "Please confirm your email before signing in.";
  if (r.includes("too many requests"))   return "Too many attempts — wait a moment and try again.";
  if (r.includes("already registered"))  return "An account with this email already exists.";
  return raw;
}

// ── Load tasks ────────────────────────────────────────────────────────────
async function loadTasks() {
  $taskList.innerHTML = `<p class="empty-state">Loading…</p>`;

  try {
    const [{ data: tasks, error: tErr }, { data: profiles }] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);

    if (tErr) throw tErr;

    const nameById = {};
    (profiles || []).forEach((p) => { nameById[p.id] = p.full_name; });

    renderTasks((tasks || []).map((t) => ({ ...t, assigneeName: nameById[t.assigned_to] || null })));
  } catch (err) {
    console.error("Tasks:", err.message);
    $taskList.innerHTML = `<p class="empty-state">Could not load tasks: ${escapeHtml(err.message)}</p>`;
  }
}

// ── Render tasks ──────────────────────────────────────────────────────────
function renderTasks(tasks) {
  if (!tasks.length) {
    $taskList.innerHTML = `<p class="empty-state">No tasks yet.</p>`;
    return;
  }

  $taskList.innerHTML = "";
  tasks.forEach((task) => {
    const isDone      = task.status === "done";
    const assignee    = task.assigneeName || "Unassigned";
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

  if (!title) { alert("Task title is required."); return; }

  setLoading($createTaskBtn, true, "Creating…", "+ Create Task");

  try {
    const { error } = await supabase.from("tasks").insert({
      title,
      notes:       notes || null,
      assigned_to: assignee,
      status:      "pending",
      created_by:  currentUser.id,
    });
    if (error) throw error;

    $taskTitle.value = $taskNotes.value = "";
    $taskAssignee.value = "";
    await loadTasks();
  } catch (err) {
    alert("Error creating task: " + err.message);
  }

  setLoading($createTaskBtn, false, "Creating…", "+ Create Task");
}

// ── Mark done ─────────────────────────────────────────────────────────────
async function handleMarkDone(taskId) {
  try {
    const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", taskId);
    if (error) throw error;
    await loadTasks();
  } catch (err) {
    alert("Failed to update task: " + err.message);
  }
}

// ── Load assignees dropdown ───────────────────────────────────────────────
async function loadAssignees() {
  try {
    const { data: users, error } = await supabase
      .from("profiles").select("id, full_name").order("full_name");
    if (error) throw error;

    $taskAssignee.innerHTML = `<option value="">Assign to user (optional)</option>`;
    (users || []).forEach((u) => {
      const opt = document.createElement("option");
      opt.value       = u.id;
      opt.textContent = u.full_name || u.id;
      $taskAssignee.appendChild(opt);
    });
  } catch (err) {
    console.warn("Assignees:", err.message);
  }
}

// ── Add user (admin creates worker directly) ──────────────────────────────
async function handleAddUser() {
  const name     = $newUserName.value.trim();
  const email    = $newUserEmail.value.trim().toLowerCase();
  const password = $newUserPassword.value;
  const role     = $newUserRole.value;

  setAddUserMsg("", "");

  if (!name)           { setAddUserMsg("Enter the worker's full name.", "error"); return; }
  if (!email)          { setAddUserMsg("Enter the worker's email.", "error"); return; }
  if (password.length < 6) { setAddUserMsg("Password must be at least 6 characters.", "error"); return; }

  setLoading($addUserBtn, true, "Adding…", "+ Add Worker");

  try {
    // Use a SEPARATE client so the admin's own session is never touched
    const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data, error: signUpErr } = await tempClient.auth.signUp({ email, password });
    if (signUpErr) throw signUpErr;

    if (data.user) {
      // Create profile for the new user
      const { error: profileErr } = await supabase.from("profiles").upsert({
        id:        data.user.id,
        full_name: name,
        role,
      });
      if (profileErr) throw profileErr;
    }

    setAddUserMsg(`✓ ${name} added successfully!`, "success");
    $newUserName.value = $newUserEmail.value = $newUserPassword.value = "";
    $newUserRole.value = "user";
    await Promise.all([loadUserManagement(), loadAssignees()]);
  } catch (err) {
    setAddUserMsg(friendlyAuthError(err.message), "error");
  }

  setLoading($addUserBtn, false, "Adding…", "+ Add Worker");
}

function setAddUserMsg(msg, type) {
  if (!msg) { $addUserMsg.style.display = "none"; return; }
  $addUserMsg.textContent  = msg;
  $addUserMsg.className    = "add-user-msg " + (type === "success" ? "add-user-success" : "add-user-error");
  $addUserMsg.style.display = "block";
}

// ── User management ───────────────────────────────────────────────────────
async function loadUserManagement() {
  $userList.innerHTML = `<p class="empty-state">Loading users…</p>`;

  try {
    const { data: users, error } = await supabase
      .from("profiles").select("id, full_name, role").order("full_name");
    if (error) throw error;

    if (!users || users.length === 0) {
      $userList.innerHTML = `<p class="empty-state">No users yet.</p>`;
      return;
    }

    $userList.innerHTML = "";
    users.forEach((u) => renderUserRow(u));
  } catch (err) {
    $userList.innerHTML = `<p class="empty-state">Could not load users: ${escapeHtml(err.message)}</p>`;
  }
}

function renderUserRow(u) {
  const isAdmin  = u.role === "admin";
  const isSelf   = u.id === currentUser.id;

  const row = document.createElement("div");
  row.className  = "user-row";
  row.dataset.id = u.id;
  row.innerHTML  = `
    <div class="user-row-info">
      <span class="user-row-name">${escapeHtml(u.full_name || "—")}</span>
      <span class="user-role-badge ${isAdmin ? "role-admin" : "role-user"}">
        ${isAdmin ? "Admin" : "User"}
      </span>
    </div>
    <button class="btn-role-toggle" data-uid="${u.id}" data-role="${u.role}" ${isSelf ? "disabled title='Cannot change your own role'" : ""}>
      ${isAdmin ? "Demote to User" : "Promote to Admin"}
    </button>
  `;

  if (!isSelf) {
    row.querySelector(".btn-role-toggle").addEventListener("click", () =>
      handleSetRole(u.id, isAdmin ? "user" : "admin")
    );
  }

  $userList.appendChild(row);
}

async function handleSetRole(userId, newRole) {
  try {
    const { error } = await supabase
      .from("profiles").update({ role: newRole }).eq("id", userId);
    if (error) throw error;
    await Promise.all([loadUserManagement(), loadAssignees()]);
  } catch (err) {
    alert("Could not update role: " + err.message);
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
