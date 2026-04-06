import { fetchTasks } from "./tasks.js";
import { renderTasks } from "./import { supabase } from “../config/supabase.js”;

// ============================================================
//  STATE
// ============================================================
let currentUser    = null;
let currentProfile = null;

// ============================================================
//  BOOT — runs on page load
// ============================================================
document.addEventListener(“DOMContentLoaded”, async () => {
const { data } = await supabase.auth.getSession();
if (data.session) {
await bootUser(data.session.user);
}
});

// ============================================================
//  LOGIN
// ============================================================
window.login = async function () {
const email    = document.getElementById(“email”).value.trim().toLowerCase();
const password = document.getElementById(“password”).value;
const btn      = document.getElementById(“loginBtn”);
const errBox   = document.getElementById(“loginError”);

errBox.style.display = “none”;

if (!email || !password) {
showError(“Please enter your email and password.”);
return;
}

btn.disabled    = true;
btn.textContent = “Signing in…”;

const { data, error } = await supabase.auth.signInWithPassword({ email, password });

btn.disabled    = false;
btn.textContent = “Sign In”;

if (error) {
showError(error.message);
return;
}

await bootUser(data.user);
};

function showError(msg) {
const errBox = document.getElementById(“loginError”);
errBox.textContent    = msg;
errBox.style.display  = “block”;
}

// ============================================================
//  LOGOUT
// ============================================================
window.logout = async function () {
await supabase.auth.signOut();
currentUser    = null;
currentProfile = null;
document.getElementById(“app”).style.display         = “none”;
document.getElementById(“loginScreen”).style.display = “flex”;
document.getElementById(“loginError”).style.display  = “none”;
document.getElementById(“email”).value    = “”;
document.getElementById(“password”).value = “”;
};

// ============================================================
//  BOOT USER — called after login or session restore
// ============================================================
async function bootUser(user) {
currentUser = user;

// Fetch profile (role) from public.profiles table
const { data: profile, error } = await supabase
.from(“profiles”)
.select(“role, full_name”)
.eq(“id”, user.id)
.single();

if (error) {
console.error(“Profile fetch error:”, error.message);
showError(“Could not load your profile. Contact your admin.”);
return;
}

currentProfile = profile;

// Show app
document.getElementById(“loginScreen”).style.display = “none”;
document.getElementById(“app”).style.display         = “block”;
document.getElementById(“userEmail”).textContent     =
profile.full_name || user.email;

// Admin panel
const adminPanel = document.getElementById(“adminPanel”);
if (profile.role === “admin”) {
adminPanel.style.display = “block”;
await loadAssignees();
} else {
adminPanel.style.display = “none”;
}

await loadTasks();
}

// ============================================================
//  TASKS — load
// ============================================================
window.loadTasks = async function () {
await loadTasks();
};

async function loadTasks() {
const container = document.getElementById(“taskList”);
container.innerHTML = `<p class="empty-state">Loading…</p>`;

const { data: tasks, error } = await supabase
.from(“tasks”)
.select(”*, profiles(full_name)”)
.order(“created_at”, { ascending: false });

if (error) {
console.error(“Tasks fetch error:”, error.message);
container.innerHTML = `<p class="empty-state">Failed to load tasks.</p>`;
return;
}

renderTasks(tasks);
}

// ============================================================
//  TASKS — render
// ============================================================
function renderTasks(tasks) {
const container = document.getElementById(“taskList”);

if (!tasks || tasks.length === 0) {
container.innerHTML = `<p class="empty-state">No tasks yet.</p>`;
return;
}

container.innerHTML = “”;

tasks.forEach(task => {
const isDone    = task.status === “done”;
const assignee  = task.profiles?.full_name || “Unassigned”;
const statusMap = {
pending:     “status-pending”,
in_progress: “status-progress”,
done:        “status-done”,
};
const statusClass = statusMap[task.status] || “status-pending”;
const statusLabel = (task.status || “pending”).replace(”_”, “ “);

```
const card = document.createElement("div");
card.className = "task-card";
card.innerHTML = `
  <div class="task-header">
    <span class="task-title ${isDone ? "done" : ""}">${escHtml(task.title)}</span>
    ${!isDone ? `<button class="btn-done" onclick="markDone('${task.id}')">Mark Done</button>` : ""}
  </div>
  ${task.notes ? `<p class="task-notes">${escHtml(task.notes)}</p>` : ""}
  <div class="task-meta">
    <span class="task-status ${statusClass}">${statusLabel}</span>
    <span style="color:var(--muted);font-size:12px;">→ ${escHtml(assignee)}</span>
  </div>
`;
container.appendChild(card);
```

});
}

// ============================================================
//  TASKS — create (admin only)
// ============================================================
window.createTask = async function () {
const title    = document.getElementById(“taskTitle”).value.trim();
const notes    = document.getElementById(“taskNotes”).value.trim();
const assignee = document.getElementById(“taskAssignee”).value || null;

if (!title) {
alert(“Task title is required.”);
return;
}

const { error } = await supabase.from(“tasks”).insert({
title,
notes:       notes || null,
assigned_to: assignee,
status:      “pending”,
created_by:  currentUser.id,
});

if (error) {
console.error(“Create task error:”, error.message);
alert(“Failed to create task: “ + error.message);
return;
}

document.getElementById(“taskTitle”).value    = “”;
document.getElementById(“taskNotes”).value    = “”;
document.getElementById(“taskAssignee”).value = “”;

await loadTasks();
};

// ============================================================
//  TASKS — mark done
// ============================================================
window.markDone = async function (taskId) {
const { error } = await supabase
.from(“tasks”)
.update({ status: “done” })
.eq(“id”, taskId);

if (error) {
alert(“Failed to update task.”);
return;
}

await loadTasks();
};

// ============================================================
//  ADMIN — load assignee list
// ============================================================
async function loadAssignees() {
const { data: users, error } = await supabase
.from(“profiles”)
.select(“id, full_name”)
.order(“full_name”);

if (error || !users) return;

const select = document.getElementById(“taskAssignee”);
select.innerHTML = `<option value="">Assign to user (optional)</option>`;
users.forEach(u => {
const opt   = document.createElement(“option”);
opt.value   = u.id;
opt.textContent = u.full_name || u.id;
select.appendChild(opt);
});
}

// ============================================================
//  UTILS
// ============================================================
function escHtml(str) {
if (!str) return “”;
return str
.replace(/&/g, “&”)
.replace(/</g, “<”)
.replace(/>/g, “>”)
.replace(/”/g, “"”);
}
window.loadTasks = async function () {
  const tasks = await fetchTasks();
  renderTasks(tasks);
};
