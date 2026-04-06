import { supabase } from "../config/supabase.js";

// ── State ────────────────────────────────────────────────────
let currentUser    = null;
let currentProfile = null;

// ── DOM refs (set once DOMContentLoaded fires) ───────────────
let $loginScreen, $app, $loginError, $loginBtn, $logoutBtn;
let $email, $password, $userEmail;
let $adminPanel, $taskTitle, $taskNotes, $taskAssignee, $createTaskBtn;
let $taskList;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Cache DOM references
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

  // Wire up all buttons here — no inline onclick anywhere
  $loginBtn.addEventListener("click", handleLogin);
  $logoutBtn.addEventListener("click", handleLogout);
  $createTaskBtn.addEventListener("click", handleCreateTask);
  $email.addEventListener("keydown",    (e) => e.key === "Enter" && handleLogin());
  $password.addEventListener("keydown", (e) => e.key === "Enter" && handleLogin());

  // Restore existing session
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      await bootUser(data.session.user);
    }
  } catch (err) {
    console.error("Session check failed:", err);
  }
});

// ── Login ────────────────────────────────────────────────────
async function handleLogin() {
  const email    = $email.value.trim().toLowerCase();
  const password = $password.value;

  hideError();

  if (!email || !password) {
    showError("Please enter your email and password.");
    return;
  }

  setLoginLoading(true);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  setLoginLoading(false);

  if (error) {
    showError(error.message);
    return;
  }

  await bootUser(data.user);
}

function setLoginLoading(loading) {
  $loginBtn.disabled   = loading;
  $loginBtn.textContent = loading ? "Signing in…" : "Sign In";
}

// ── Logout ───────────────────────────────────────────────────
async function handleLogout() {
  await supabase.auth.signOut();
  currentUser    = null;
  currentProfile = null;
  showLoginScreen();
}

// ── Boot user after successful auth ──────────────────────────
async function bootUser(user) {
  currentUser = user;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Profile fetch failed:", error.message);
    showError("Could not load your profile. Please try again.");
    return;
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

// ── Screen helpers ───────────────────────────────────────────
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

// ── Error helpers ────────────────────────────────────────────
function showError(msg) {
  $loginError.textContent    = msg;
  $loginError.style.display  = "block";
}

function hideError() {
  $loginError.style.display  = "none";
  $loginError.textContent    = "";
}

// ── Load tasks ───────────────────────────────────────────────
async function loadTasks() {
  $taskList.innerHTML = `<p class="empty-state">Loading…</p>`;

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Tasks fetch failed:", error.message);
    $taskList.innerHTML = `<p class="empty-state">Failed to load tasks. Try refreshing.</p>`;
    return;
  }

  renderTasks(tasks);
}

// ── Render tasks ─────────────────────────────────────────────
function renderTasks(tasks) {
  if (!tasks || tasks.length === 0) {
    $taskList.innerHTML = `<p class="empty-state">No tasks yet.</p>`;
    return;
  }

  $taskList.innerHTML = "";

  tasks.forEach((task) => {
    const isDone       = task.status === "done";
    const assignee     = task.profiles?.full_name || "Unassigned";
    const statusClass  = isDone ? "status-done" : "status-pending";
    const statusLabel  = isDone ? "Done" : "Pending";

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

    // Wire the "Mark Done" button with addEventListener (no inline onclick)
    if (!isDone) {
      card.querySelector(".btn-done").addEventListener("click", () => handleMarkDone(task.id));
    }

    $taskList.appendChild(card);
  });
}

// ── Create task (admin) ──────────────────────────────────────
async function handleCreateTask() {
  const title    = $taskTitle.value.trim();
  const notes    = $taskNotes.value.trim();
  const assignee = $taskAssignee.value || null;

  if (!title) {
    alert("Task title is required.");
    return;
  }

  $createTaskBtn.disabled   = true;
  $createTaskBtn.textContent = "Creating…";

  const { error } = await supabase.from("tasks").insert({
    title,
    notes:       notes || null,
    assigned_to: assignee,
    status:      "pending",
    created_by:  currentUser.id,
  });

  $createTaskBtn.disabled   = false;
  $createTaskBtn.textContent = "+ Create Task";

  if (error) {
    alert("Error creating task: " + error.message);
    return;
  }

  $taskTitle.value    = "";
  $taskNotes.value    = "";
  $taskAssignee.value = "";

  await loadTasks();
}

// ── Mark task done ───────────────────────────────────────────
async function handleMarkDone(taskId) {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "done" })
    .eq("id", taskId);

  if (error) {
    alert("Failed to update task: " + error.message);
    return;
  }

  await loadTasks();
}

// ── Load assignee dropdown (admin) ───────────────────────────
async function loadAssignees() {
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");

  if (error) return;

  $taskAssignee.innerHTML = `<option value="">Assign to user (optional)</option>`;
  users.forEach((u) => {
    const opt       = document.createElement("option");
    opt.value       = u.id;
    opt.textContent = u.full_name || u.id;
    $taskAssignee.appendChild(opt);
  });
}

// ── XSS helper ───────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
