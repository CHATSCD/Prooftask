window.addEventListener("error", (e) => {
  const box = document.getElementById("loginError");
  if (box) { box.textContent = "App error: " + (e.message || e.type); box.style.display = "block"; }
});

import { supabase, SUPABASE_URL, SUPABASE_ANON } from "../config/supabase.js?v=11";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Config ────────────────────────────────────────────────────────────────
const SUPER_ADMINS    = ["shauncdubuisson@gmail.com"];
const REQUIRED_PHOTOS = 3;
const OVERDUE_CHECK_MS = 60_000; // check every 60 seconds

// ── State ─────────────────────────────────────────────────────────────────
let currentUser    = null;
let currentProfile = null;
let cameraStream   = null;
let capturedPhotos = [];
let proofTaskId    = null;
let proofTaskTitle = null;
let tsInterval     = null;
let overdueInterval = null;
// Track which task IDs we've already fired a browser notification for
const notifiedIds = new Set(JSON.parse(localStorage.getItem("pt_notified") || "[]"));

// ── DOM refs ──────────────────────────────────────────────────────────────
let $loginScreen, $app, $loginError, $loginSuccess;
let $tabSignIn, $tabSignUp, $formSignIn, $formSignUp;
let $loginBtn, $registerBtn, $logoutBtn;
let $email, $password, $regName, $regEmail, $regPassword;
let $userEmail, $adminPanel, $userMgmtPanel;
let $taskTitle, $taskNotes, $taskAssignee, $taskDueAt, $createTaskBtn;
let $taskList, $userList;
let $newUserName, $newUserEmail, $newUserPassword, $newUserRole, $addUserBtn, $addUserMsg;
let $notifBell, $notifBadge, $notifPanel, $notifClose, $notifList, $overdueCount;
let $proofModal, $proofTaskName, $cameraVideo, $liveTimestamp;
let $progressLabel, $proofThumbs, $proofInstruction;
let $captureBtn, $submitProofBtn, $cancelProofBtn, $proofError;
let $dots;

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  $loginScreen   = document.getElementById("loginScreen");
  $app           = document.getElementById("app");
  $loginError    = document.getElementById("loginError");
  $loginSuccess  = document.getElementById("loginSuccess");
  $tabSignIn     = document.getElementById("tabSignIn");
  $tabSignUp     = document.getElementById("tabSignUp");
  $formSignIn    = document.getElementById("formSignIn");
  $formSignUp    = document.getElementById("formSignUp");
  $loginBtn      = document.getElementById("loginBtn");
  $registerBtn   = document.getElementById("registerBtn");
  $logoutBtn     = document.getElementById("logoutBtn");
  $email         = document.getElementById("email");
  $password      = document.getElementById("password");
  $regName       = document.getElementById("regName");
  $regEmail      = document.getElementById("regEmail");
  $regPassword   = document.getElementById("regPassword");
  $userEmail     = document.getElementById("userEmail");
  $adminPanel    = document.getElementById("adminPanel");
  $userMgmtPanel = document.getElementById("userMgmtPanel");
  $taskTitle     = document.getElementById("taskTitle");
  $taskNotes     = document.getElementById("taskNotes");
  $taskAssignee  = document.getElementById("taskAssignee");
  $taskDueAt     = document.getElementById("taskDueAt");
  $createTaskBtn = document.getElementById("createTaskBtn");
  $taskList      = document.getElementById("taskList");
  $userList      = document.getElementById("userList");
  $newUserName   = document.getElementById("newUserName");
  $newUserEmail  = document.getElementById("newUserEmail");
  $newUserPassword = document.getElementById("newUserPassword");
  $newUserRole   = document.getElementById("newUserRole");
  $addUserBtn    = document.getElementById("addUserBtn");
  $addUserMsg    = document.getElementById("addUserMsg");
  $notifBell     = document.getElementById("notifBell");
  $notifBadge    = document.getElementById("notifBadge");
  $notifPanel    = document.getElementById("notifPanel");
  $notifClose    = document.getElementById("notifClose");
  $notifList     = document.getElementById("notifList");
  $overdueCount  = document.getElementById("overdueCount");
  $proofModal       = document.getElementById("proofModal");
  $proofTaskName    = document.getElementById("proofTaskName");
  $cameraVideo      = document.getElementById("cameraVideo");
  $liveTimestamp    = document.getElementById("liveTimestamp");
  $progressLabel    = document.getElementById("progressLabel");
  $proofThumbs      = document.getElementById("proofThumbs");
  $proofInstruction = document.getElementById("proofInstruction");
  $captureBtn       = document.getElementById("captureBtn");
  $submitProofBtn   = document.getElementById("submitProofBtn");
  $cancelProofBtn   = document.getElementById("cancelProofBtn");
  $proofError       = document.getElementById("proofError");
  $dots = [0,1,2].map((i) => document.getElementById("dot" + i));

  $tabSignIn.addEventListener("click",  () => switchTab("signin"));
  $tabSignUp.addEventListener("click",  () => switchTab("signup"));
  $loginBtn.addEventListener("click",   handleLogin);
  $registerBtn.addEventListener("click", handleRegister);
  $logoutBtn.addEventListener("click",  handleLogout);
  $createTaskBtn.addEventListener("click", handleCreateTask);
  $addUserBtn.addEventListener("click", handleAddUser);
  $captureBtn.addEventListener("click", capturePhoto);
  $submitProofBtn.addEventListener("click", submitProof);
  $cancelProofBtn.addEventListener("click", closeProofModal);
  $notifBell.addEventListener("click",  toggleNotifPanel);
  $notifClose.addEventListener("click", () => { $notifPanel.style.display = "none"; });
  $email.addEventListener("keydown",    (e) => e.key === "Enter" && handleLogin());
  $password.addEventListener("keydown", (e) => e.key === "Enter" && handleLogin());

  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) await bootUser(data.session.user);
  } catch (err) { console.warn("Session:", err.message); }
});

// ── Auth tab ──────────────────────────────────────────────────────────────
function switchTab(tab) {
  hideMessages();
  const isIn = tab === "signin";
  $tabSignIn.classList.toggle("active",  isIn);
  $tabSignUp.classList.toggle("active", !isIn);
  $formSignIn.style.display = isIn ? "block" : "none";
  $formSignUp.style.display = isIn ? "none"  : "block";
}

// ── Login ─────────────────────────────────────────────────────────────────
async function handleLogin() {
  const email = $email.value.trim().toLowerCase();
  const pass  = $password.value;
  hideMessages();
  if (!email || !pass) { showError("Please enter your email and password."); return; }
  setLoading($loginBtn, true, "Signing in…", "Sign In");
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    await bootUser(data.user);
  } catch (err) { showError(friendlyAuthError(err.message)); }
  setLoading($loginBtn, false, "Signing in…", "Sign In");
}

// ── Register ──────────────────────────────────────────────────────────────
async function handleRegister() {
  const name  = $regName.value.trim();
  const email = $regEmail.value.trim().toLowerCase();
  const pass  = $regPassword.value;
  hideMessages();
  if (!name)           { showError("Enter your full name."); return; }
  if (!email)          { showError("Enter your email."); return; }
  if (pass.length < 6) { showError("Password must be at least 6 characters."); return; }
  setLoading($registerBtn, true, "Creating…", "Create Account");
  try {
    const { data, error } = await supabase.auth.signUp({ email, password: pass });
    if (error) throw error;
    if (data.user) await supabase.from("profiles").upsert({ id: data.user.id, full_name: name, role: "user" });
    showSuccess("Account created! Check your email to confirm, then sign in.");
    $regName.value = $regEmail.value = $regPassword.value = "";
    switchTab("signin");
  } catch (err) { showError(friendlyAuthError(err.message)); }
  setLoading($registerBtn, false, "Creating…", "Create Account");
}

// ── Logout ────────────────────────────────────────────────────────────────
async function handleLogout() {
  stopOverdueChecker();
  await supabase.auth.signOut().catch(() => {});
  currentUser = currentProfile = null;
  showLoginScreen();
}

// ── Boot user ─────────────────────────────────────────────────────────────
async function bootUser(user) {
  currentUser = user;
  const isSuperAdmin = SUPER_ADMINS.includes(user.email?.toLowerCase());
  let profile = { role: isSuperAdmin ? "admin" : "user", full_name: null };

  try {
    const { data, error } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
    if (!error && data) profile = { ...data, role: isSuperAdmin ? "admin" : data.role };
  } catch (err) { console.warn("Profile:", err.message); }

  if (isSuperAdmin) {
    await supabase.from("profiles").upsert({ id: user.id, full_name: profile.full_name || user.email, role: "admin" });
  }

  currentProfile = profile;
  showAppScreen(profile.full_name || user.email);

  const isAdmin = profile.role === "admin";
  $adminPanel.style.display    = isAdmin ? "block" : "none";
  $userMgmtPanel.style.display = isAdmin ? "block" : "none";
  if (isAdmin) await Promise.all([loadAssignees(), loadUserManagement()]);

  // Request notification permission
  requestNotifPermission();

  await loadTasks();
  startOverdueChecker();
}

// ── Screens ───────────────────────────────────────────────────────────────
function showLoginScreen() {
  $app.style.display = "none"; $loginScreen.style.display = "flex";
  $email.value = $password.value = ""; hideMessages();
}
function showAppScreen(name) {
  $loginScreen.style.display = "none"; $app.style.display = "block";
  $userEmail.textContent = name;
}

// ── Messages ──────────────────────────────────────────────────────────────
function showError(m)   { $loginError.textContent = m;   $loginError.style.display = "block";  $loginSuccess.style.display = "none"; }
function showSuccess(m) { $loginSuccess.textContent = m; $loginSuccess.style.display = "block"; $loginError.style.display = "none"; }
function hideMessages() { $loginError.style.display = "none"; $loginSuccess.style.display = "none"; }
function setLoading(btn, on, t1, t2) { btn.disabled = on; btn.textContent = on ? t1 : t2; }
function friendlyAuthError(raw) {
  if (!raw) return "Something went wrong.";
  const r = raw.toLowerCase();
  if (r.includes("invalid login") || r.includes("invalid credentials")) return "Incorrect email or password.";
  if (r.includes("email not confirmed")) return "Please confirm your email first.";
  if (r.includes("too many requests"))   return "Too many attempts — wait a moment.";
  if (r.includes("already registered"))  return "An account with this email already exists.";
  return raw;
}

// ══════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS & OVERDUE
// ══════════════════════════════════════════════════════════════════════════

function requestNotifPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function startOverdueChecker() {
  stopOverdueChecker();
  checkOverdueTasks();
  overdueInterval = setInterval(checkOverdueTasks, OVERDUE_CHECK_MS);
}

function stopOverdueChecker() {
  if (overdueInterval) { clearInterval(overdueInterval); overdueInterval = null; }
}

async function checkOverdueTasks() {
  if (!currentUser) return;
  try {
    const isAdmin = currentProfile?.role === "admin";
    const now = new Date().toISOString();

    let query = supabase.from("tasks")
      .select("id, title, due_at, assigned_to")
      .eq("status", "pending")
      .not("due_at", "is", null)
      .lt("due_at", now);

    // Workers only see their own overdue tasks
    if (!isAdmin) query = query.eq("assigned_to", currentUser.id);

    const { data: overdue } = await query;
    if (!overdue) return;

    updateOverdueBadge(overdue.length);
    renderNotifPanel(overdue);

    // Fire browser notification for newly overdue tasks
    overdue.forEach((task) => {
      if (notifiedIds.has(task.id)) return;
      notifiedIds.add(task.id);
      localStorage.setItem("pt_notified", JSON.stringify([...notifiedIds]));
      sendBrowserNotif(
        "⚠️ Overdue Task",
        `"${task.title}" is past its due time.`
      );
    });
  } catch (err) { console.warn("Overdue check:", err.message); }
}

function sendBrowserNotif(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    });
  } catch (err) { console.warn("Notification:", err.message); }
}

function updateOverdueBadge(count) {
  if (count > 0) {
    $notifBadge.textContent    = count;
    $notifBadge.style.display  = "flex";
    $overdueCount.textContent  = `${count} overdue`;
    $overdueCount.style.display = "inline-flex";
    $notifBell.classList.add("has-notif");
  } else {
    $notifBadge.style.display   = "none";
    $overdueCount.style.display = "none";
    $notifBell.classList.remove("has-notif");
  }
}

function renderNotifPanel(overdue) {
  if (!overdue.length) {
    $notifList.innerHTML = `<p class="notif-empty">No overdue tasks.</p>`;
    return;
  }
  $notifList.innerHTML = "";
  overdue.forEach((task) => {
    const dueDate = new Date(task.due_at).toLocaleString();
    const row = document.createElement("div");
    row.className = "notif-item";
    row.innerHTML = `
      <div class="notif-item-title">${escapeHtml(task.title)}</div>
      <div class="notif-item-due">Due: ${dueDate}</div>
    `;
    $notifList.appendChild(row);
  });
}

function toggleNotifPanel() {
  const visible = $notifPanel.style.display !== "none";
  $notifPanel.style.display = visible ? "none" : "block";
}

// ══════════════════════════════════════════════════════════════════════════
//  TASKS
// ══════════════════════════════════════════════════════════════════════════

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

function renderTasks(tasks) {
  if (!tasks.length) { $taskList.innerHTML = `<p class="empty-state">No tasks yet.</p>`; return; }
  $taskList.innerHTML = "";
  const now = new Date();

  tasks.forEach((task) => {
    const isDone      = task.status === "done";
    const assignee    = task.assigneeName || "Unassigned";
    const photos      = task.proof_photos || [];
    const completedAt = task.completed_at ? new Date(task.completed_at).toLocaleString() : null;

    // Due date logic
    let dueHtml = "";
    let isOverdue = false;
    if (task.due_at) {
      const dueDate = new Date(task.due_at);
      isOverdue = !isDone && dueDate < now;
      const dueStr = dueDate.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      dueHtml = `<span class="task-due${isOverdue ? " overdue" : ""}">
        ${isOverdue ? "⚠️ OVERDUE" : "⏰"} Due: ${dueStr}
      </span>`;
    }

    const statusClass = isDone ? "status-done" : (isOverdue ? "status-overdue" : "status-pending");
    const statusLabel = isDone ? "Done" : (isOverdue ? "Overdue" : "Pending");

    const card = document.createElement("div");
    card.className = `task-card${isOverdue ? " overdue" : ""}`;
    card.innerHTML = `
      <div class="task-header">
        <span class="task-title${isDone ? " done" : ""}">${escapeHtml(task.title)}</span>
        ${!isDone ? `<button class="btn-done" data-id="${task.id}" data-title="${escapeHtml(task.title)}">&#128247; Prove Done</button>` : ""}
      </div>
      ${task.notes ? `<p class="task-notes">${escapeHtml(task.notes)}</p>` : ""}
      ${dueHtml}
      <div class="task-meta">
        <span class="task-status ${statusClass}">${statusLabel}</span>
        <span class="task-assignee">&#8594; ${escapeHtml(assignee)}</span>
        ${isDone && completedAt ? `<span class="task-completed-at">&#10003; ${completedAt}</span>` : ""}
        ${photos.length ? `<span class="task-photo-count">&#128247; ${photos.length} photos</span>` : ""}
      </div>
      ${isDone && photos.length ? `
        <div class="proof-thumb-row">
          ${photos.map((url) => `<img src="${escapeHtml(url)}" class="proof-thumb-small" />`).join("")}
        </div>` : ""}
    `;

    if (!isDone) {
      card.querySelector(".btn-done").addEventListener("click", (e) => {
        const b = e.currentTarget;
        openProofModal(b.dataset.id, b.dataset.title);
      });
    }
    $taskList.appendChild(card);
  });
}

async function handleCreateTask() {
  const title    = $taskTitle.value.trim();
  const notes    = $taskNotes.value.trim();
  const assignee = $taskAssignee.value || null;
  const dueAt    = $taskDueAt.value ? new Date($taskDueAt.value).toISOString() : null;

  if (!title) { alert("Task title is required."); return; }
  setLoading($createTaskBtn, true, "Creating…", "+ Create Task");
  try {
    const { error } = await supabase.from("tasks").insert({
      title, notes: notes || null, assigned_to: assignee,
      status: "pending", created_by: currentUser.id,
      due_at: dueAt,
    });
    if (error) throw error;
    $taskTitle.value = $taskNotes.value = $taskDueAt.value = "";
    $taskAssignee.value = "";
    await loadTasks();
    checkOverdueTasks();
  } catch (err) { alert("Error: " + err.message); }
  setLoading($createTaskBtn, false, "Creating…", "+ Create Task");
}

// ══════════════════════════════════════════════════════════════════════════
//  PROOF PHOTO SYSTEM
// ══════════════════════════════════════════════════════════════════════════

async function openProofModal(taskId, taskTitle) {
  proofTaskId = taskId; proofTaskTitle = taskTitle;
  capturedPhotos = [];
  $proofTaskName.textContent    = taskTitle;
  $proofThumbs.innerHTML        = "";
  $proofError.style.display     = "none";
  $submitProofBtn.style.display = "none";
  $captureBtn.style.display     = "block";
  $cameraVideo.style.display    = "block";
  $liveTimestamp.style.display  = "block";
  $proofModal.style.display     = "flex";
  updateProofProgress();
  startLiveTimestamp();
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    $cameraVideo.srcObject = cameraStream;
    await $cameraVideo.play();
  } catch (err) {
    $proofError.textContent   = "Camera access denied. Please allow camera permission and try again.";
    $proofError.style.display = "block";
    $captureBtn.disabled      = true;
  }
}

function closeProofModal() {
  stopCamera(); stopLiveTimestamp();
  $proofModal.style.display = "none";
  capturedPhotos = []; proofTaskId = null;
}
function stopCamera() {
  if (cameraStream) { cameraStream.getTracks().forEach((t) => t.stop()); cameraStream = null; }
  $cameraVideo.srcObject = null;
}
function startLiveTimestamp() {
  const tick = () => { $liveTimestamp.textContent = new Date().toLocaleString(); };
  tick();
  tsInterval = setInterval(tick, 1000);
}
function stopLiveTimestamp() {
  if (tsInterval) { clearInterval(tsInterval); tsInterval = null; }
}

function updateProofProgress() {
  const count = capturedPhotos.length;
  if (count < REQUIRED_PHOTOS) {
    $progressLabel.textContent = `Take photo ${count + 1} of ${REQUIRED_PHOTOS}`;
    $proofInstruction.textContent = ["Point camera at the task area.",
      "Move to a different angle for photo 2.",
      "One more photo from another angle."][count];
    $captureBtn.style.display     = "block";
    $submitProofBtn.style.display = "none";
  } else {
    $progressLabel.textContent    = "All photos captured!";
    $proofInstruction.textContent = "Tap Submit to complete this task.";
    $captureBtn.style.display     = "none";
    $submitProofBtn.style.display = "block";
    $cameraVideo.style.display    = "none";
    $liveTimestamp.style.display  = "none";
    stopCamera(); stopLiveTimestamp();
  }
  $dots.forEach((d, i) => d.classList.toggle("filled", i < count));
}

function capturePhoto() {
  if (!cameraStream) return;
  const v = $cameraVideo;
  const canvas = document.createElement("canvas");
  canvas.width = v.videoWidth || 1280; canvas.height = v.videoHeight || 720;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
  const now    = new Date();
  const tsText = `ProofTask  ·  ${now.toLocaleString()}`;
  const barH   = Math.round(canvas.height * 0.065);
  const fs     = Math.round(barH * 0.55);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, canvas.height - barH, canvas.width, barH);
  ctx.fillStyle = "#fff"; ctx.font = `bold ${fs}px 'Space Mono', monospace`;
  ctx.textBaseline = "middle";
  ctx.fillText(tsText, 12, canvas.height - barH / 2);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  canvas.toBlob((blob) => {
    capturedPhotos.push({ blob, dataUrl, timestamp: now.toISOString() });
    const img = document.createElement("img");
    img.src = dataUrl; img.className = "proof-thumb";
    $proofThumbs.appendChild(img);
    updateProofProgress();
  }, "image/jpeg", 0.88);
}

async function submitProof() {
  if (capturedPhotos.length < REQUIRED_PHOTOS) return;
  setLoading($submitProofBtn, true, "Uploading…", "✓ Submit & Complete Task");
  $proofError.style.display = "none";
  try {
    const photoUrls = await Promise.all(
      capturedPhotos.map(async ({ blob }, i) => {
        const path = `${proofTaskId}/${Date.now()}_${i}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("task-proofs").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw new Error("Upload failed: " + upErr.message);
        return supabase.storage.from("task-proofs").getPublicUrl(path).data.publicUrl;
      })
    );
    const { error: updateErr } = await supabase.from("tasks").update({
      status: "done", proof_photos: photoUrls,
      completed_at: new Date().toISOString(), completed_by: currentUser.id,
    }).eq("id", proofTaskId);
    if (updateErr) throw updateErr;
    // Remove from overdue tracking since task is now done
    notifiedIds.delete(proofTaskId);
    localStorage.setItem("pt_notified", JSON.stringify([...notifiedIds]));
    closeProofModal();
    await loadTasks();
    checkOverdueTasks();
  } catch (err) {
    $proofError.textContent = "Failed: " + err.message;
    $proofError.style.display = "block";
    setLoading($submitProofBtn, false, "Uploading…", "✓ Submit & Complete Task");
  }
}

// ── Add user ──────────────────────────────────────────────────────────────
async function handleAddUser() {
  const name  = $newUserName.value.trim();
  const email = $newUserEmail.value.trim().toLowerCase();
  const pass  = $newUserPassword.value;
  const role  = $newUserRole.value;
  setAddUserMsg("", "");
  if (!name)           { setAddUserMsg("Enter the worker's full name.", "error"); return; }
  if (!email)          { setAddUserMsg("Enter the worker's email.", "error"); return; }
  if (pass.length < 6) { setAddUserMsg("Password must be at least 6 characters.", "error"); return; }
  setLoading($addUserBtn, true, "Adding…", "+ Add Worker");
  try {
    const tmp = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data, error: sErr } = await tmp.auth.signUp({ email, password: pass });
    if (sErr) throw sErr;
    if (data.user) {
      const { error: pErr } = await supabase.from("profiles").upsert({ id: data.user.id, full_name: name, role });
      if (pErr) throw pErr;
    }
    setAddUserMsg(`${name} added!`, "success");
    $newUserName.value = $newUserEmail.value = $newUserPassword.value = "";
    $newUserRole.value = "user";
    await Promise.all([loadUserManagement(), loadAssignees()]);
  } catch (err) { setAddUserMsg(friendlyAuthError(err.message), "error"); }
  setLoading($addUserBtn, false, "Adding…", "+ Add Worker");
}

function setAddUserMsg(msg, type) {
  if (!msg) { $addUserMsg.style.display = "none"; return; }
  $addUserMsg.textContent   = msg;
  $addUserMsg.className     = "add-user-msg " + (type === "success" ? "add-user-success" : "add-user-error");
  $addUserMsg.style.display = "block";
}

async function loadUserManagement() {
  $userList.innerHTML = `<p class="empty-state">Loading…</p>`;
  try {
    const { data: users, error } = await supabase.from("profiles").select("id, full_name, role").order("full_name");
    if (error) throw error;
    if (!users?.length) { $userList.innerHTML = `<p class="empty-state">No users yet.</p>`; return; }
    $userList.innerHTML = "";
    users.forEach(renderUserRow);
  } catch (err) { $userList.innerHTML = `<p class="empty-state">Could not load users.</p>`; }
}

function renderUserRow(u) {
  const isAdmin = u.role === "admin", isSelf = u.id === currentUser.id;
  const row = document.createElement("div");
  row.className = "user-row";
  row.innerHTML = `
    <div class="user-row-info">
      <span class="user-row-name">${escapeHtml(u.full_name || "—")}</span>
      <span class="user-role-badge ${isAdmin ? "role-admin" : "role-user"}">${isAdmin ? "Admin" : "User"}</span>
    </div>
    <button class="btn-role-toggle" ${isSelf ? "disabled" : ""}>${isAdmin ? "Demote" : "Promote to Admin"}</button>
  `;
  if (!isSelf) row.querySelector(".btn-role-toggle").addEventListener("click", () => handleSetRole(u.id, isAdmin ? "user" : "admin"));
  $userList.appendChild(row);
}

async function handleSetRole(userId, newRole) {
  try {
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    if (error) throw error;
    await Promise.all([loadUserManagement(), loadAssignees()]);
  } catch (err) { alert("Could not update role: " + err.message); }
}

async function loadAssignees() {
  try {
    const { data: users, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
    if (error) throw error;
    $taskAssignee.innerHTML = `<option value="">Assign to user (optional)</option>`;
    (users || []).forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id; opt.textContent = u.full_name || u.id;
      $taskAssignee.appendChild(opt);
    });
  } catch (err) { console.warn("Assignees:", err.message); }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
