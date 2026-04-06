// ============================================================
//  IMPORTS
// ============================================================
import { supabase } from "../config/supabase.js";

// ============================================================
//  STATE
// ============================================================
let currentUser = null;
let currentProfile = null;

// ============================================================
//  INIT (on page load)
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
  // Allow Enter key to submit login
  document.getElementById("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
  document.getElementById("email").addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });

  const { data } = await supabase.auth.getSession();
  if (data?.session) {
    await bootUser(data.session.user);
  }
});

// ============================================================
//  LOGIN
// ============================================================
window.login = async function () {
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("loginBtn");
  const errBox = document.getElementById("loginError");

  errBox.style.display = "none";

  if (!email || !password) {
    showError("Please enter your email and password.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Signing in...";

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  btn.disabled = false;
  btn.textContent = "Sign In";

  if (error) {
    showError(error.message);
    return;
  }

  await bootUser(data.user);
};

// ============================================================
//  LOGOUT
// ============================================================
window.logout = async function () {
  await supabase.auth.signOut();

  currentUser = null;
  currentProfile = null;

  document.getElementById("app").style.display = "none";
  document.getElementById("loginScreen").style.display = "flex";

  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
};

// ============================================================
//  ERROR DISPLAY
// ============================================================
function showError(msg) {
  const errBox = document.getElementById("loginError");
  errBox.textContent = msg;
  errBox.style.display = "block";
}

// ============================================================
//  BOOT USER (after login)
// ============================================================
async function bootUser(user) {
  currentUser = user;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Profile error:", error.message);
    showError("Failed to load profile. Please try again.");
    return;
  }

  currentProfile = profile;

  // Switch to main app
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display = "block";
  document.getElementById("userEmail").textContent =
    profile.full_name || user.email;

  // Admin panel
  const adminPanel = document.getElementById("adminPanel");
  if (profile.role === "admin") {
    adminPanel.style.display = "block";
    await loadAssignees();
  } else {
    adminPanel.style.display = "none";
  }

  await loadTasks();
}

// ============================================================
//  LOAD TASKS
// ============================================================
async function loadTasks() {
  const container = document.getElementById("taskList");
  container.innerHTML = `<p class="empty-state">Loading...</p>`;

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Tasks error:", error.message);
    container.innerHTML = `<p class="empty-state">Failed to load tasks.</p>`;
    return;
  }

  renderTasks(tasks);
}

window.loadTasks = loadTasks;

// ============================================================
//  RENDER TASKS
// ============================================================
function renderTasks(tasks) {
  const container = document.getElementById("taskList");

  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<p class="empty-state">No tasks yet.</p>`;
    return;
  }

  container.innerHTML = "";

  tasks.forEach((task) => {
    const isDone = task.status === "done";
    const assignee = task.profiles?.full_name || "Unassigned";
    const statusClass = isDone ? "status-done" : "status-pending";
    const statusLabel = isDone ? "Done" : "Pending";

    const card = document.createElement("div");
    card.className = "task-card";

    card.innerHTML = `
      <div class="task-header">
        <span class="task-title${isDone ? " done" : ""}">
          ${escapeHtml(task.title)}
        </span>
        ${
          !isDone
            ? `<button class="btn-done" onclick="markDone('${task.id}')">Mark Done</button>`
            : ""
        }
      </div>
      ${
        task.notes
          ? `<p class="task-notes">${escapeHtml(task.notes)}</p>`
          : ""
      }
      <div class="task-meta">
        <span class="task-status ${statusClass}">${statusLabel}</span>
        <span class="task-assignee">→ ${escapeHtml(assignee)}</span>
      </div>
    `;

    container.appendChild(card);
  });
}

// ============================================================
//  CREATE TASK (ADMIN)
// ============================================================
window.createTask = async function () {
  const title = document.getElementById("taskTitle").value.trim();
  const notes = document.getElementById("taskNotes").value.trim();
  const assignee = document.getElementById("taskAssignee").value || null;
  const btn = document.querySelector(".btn-create");

  if (!title) {
    alert("Task title is required.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Creating...";

  const { error } = await supabase.from("tasks").insert({
    title,
    notes: notes || null,
    assigned_to: assignee,
    status: "pending",
    created_by: currentUser.id,
  });

  btn.disabled = false;
  btn.textContent = "+ Create Task";

  if (error) {
    alert("Error creating task: " + error.message);
    return;
  }

  document.getElementById("taskTitle").value = "";
  document.getElementById("taskNotes").value = "";
  document.getElementById("taskAssignee").value = "";

  await loadTasks();
};

// ============================================================
//  MARK DONE
// ============================================================
window.markDone = async function (taskId) {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "done" })
    .eq("id", taskId);

  if (error) {
    alert("Failed to update task: " + error.message);
    return;
  }

  await loadTasks();
};

// ============================================================
//  LOAD ASSIGNEES (ADMIN)
// ============================================================
async function loadAssignees() {
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");

  if (error) return;

  const select = document.getElementById("taskAssignee");
  select.innerHTML = `<option value="">Assign to user (optional)</option>`;

  users.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.full_name || u.id;
    select.appendChild(opt);
  });
}

// ============================================================
//  UTIL
// ============================================================
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
