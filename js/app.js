// ── Surface module load errors visibly ────────────────────────────────────
window.addEventListener("error", (e) => {
  const box = document.getElementById("loginError");
  if (box) { box.textContent = "App error: " + (e.message || e.type); box.style.display = "block"; }
});

import { supabase, SUPABASE_URL, SUPABASE_ANON } from "../config/supabase.js?v=10";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Hardwired super-admins ────────────────────────────────────────────────
const SUPER_ADMINS = ["shauncdubuisson@gmail.com"];

// ── Proof photo config ────────────────────────────────────────────────────
const REQUIRED_PHOTOS = 3;

// ── State ─────────────────────────────────────────────────────────────────
let currentUser    = null;
let currentProfile = null;
let cameraStream   = null;
let capturedPhotos = [];       // [{ blob, dataUrl, timestamp }]
let proofTaskId    = null;
let proofTaskTitle = null;
let tsInterval     = null;

// ── DOM refs ──────────────────────────────────────────────────────────────
let $loginScreen, $app, $loginError, $loginSuccess;
let $tabSignIn, $tabSignUp, $formSignIn, $formSignUp;
let $loginBtn, $registerBtn, $logoutBtn;
let $email, $password, $regName, $regEmail, $regPassword;
let $userEmail, $adminPanel, $userMgmtPanel;
let $taskTitle, $taskNotes, $taskAssignee, $createTaskBtn;
let $taskList, $userList;
let $newUserName, $newUserEmail, $newUserPassword, $newUserRole, $addUserBtn, $addUserMsg;
// proof modal
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
  $createTaskBtn = document.getElementById("createTaskBtn");
  $taskList      = document.getElementById("taskList");
  $userList      = document.getElementById("userList");
  $newUserName   = document.getElementById("newUserName");
  $newUserEmail  = document.getElementById("newUserEmail");
  $newUserPassword = document.getElementById("newUserPassword");
  $newUserRole   = document.getElementById("newUserRole");
  $addUserBtn    = document.getElementById("addUserBtn");
  $addUserMsg    = document.getElementById("addUserMsg");
  // proof modal
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
  $dots             = [0, 1, 2].map((i) => document.getElementById("dot" + i));

  // Events
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
  $email.addEventListener("keydown",    (e) => e.key === "Enter" && handleLogin());
  $password.addEventListener("keydown", (e) => e.key === "Enter" && handleLogin());

  // Session restore
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) await bootUser(data.session.user);
  } catch (err) {
    console.warn("Session restore:", err.message);
  }
});

// ── Auth tab ──────────────────────────────────────────────────────────────
function switchTab(tab) {
  hideMessages();
  const isSignIn = tab === "signin";
  $tabSignIn.classList.toggle("active",  isSignIn);
  $tabSignUp.classList.toggle("active", !isSignIn);
  $formSignIn.style.display = isSignIn ? "block" : "none";
  $formSignUp.style.display = isSignIn ? "none"  : "block";
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
  } catch (err) {
    showError(friendlyAuthError(err.message));
  }
  setLoading($loginBtn, false, "Signing in…", "Sign In");
}

// ── Register ──────────────────────────────────────────────────────────────
async function handleRegister() {
  const name  = $regName.value.trim();
  const email = $regEmail.value.trim().toLowerCase();
  const pass  = $regPassword.value;
  hideMessages();
  if (!name)         { showError("Enter your full name."); return; }
  if (!email)        { showError("Enter your email."); return; }
  if (pass.length < 6) { showError("Password must be at least 6 characters."); return; }
  setLoading($registerBtn, true, "Creating…", "Create Account");
  try {
    const { data, error } = await supabase.auth.signUp({ email, password: pass });
    if (error) throw error;
    if (data.user) {
      await supabase.from("profiles").upsert({ id: data.user.id, full_name: name, role: "user" });
    }
    showSuccess("Account created! Check your email to confirm, then sign in.");
    $regName.value = $regEmail.value = $regPassword.value = "";
    switchTab("signin");
  } catch (err) {
    showError(friendlyAuthError(err.message));
  }
  setLoading($registerBtn, false, "Creating…", "Create Account");
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
  const isSuperAdmin = SUPER_ADMINS.includes(user.email?.toLowerCase());
  let profile = { role: isSuperAdmin ? "admin" : "user", full_name: null };

  try {
    const { data, error } = await supabase
      .from("profiles").select("role, full_name").eq("id", user.id).single();
    if (!error && data) {
      profile = { ...data, role: isSuperAdmin ? "admin" : data.role };
    }
  } catch (err) { console.warn("Profile:", err.message); }

  if (isSuperAdmin) {
    await supabase.from("profiles").upsert({
      id: user.id, full_name: profile.full_name || user.email, role: "admin",
    });
  }

  currentProfile = profile;
  showAppScreen(profile.full_name || user.email);

  const isAdmin = profile.role === "admin";
  $adminPanel.style.display    = isAdmin ? "block" : "none";
  $userMgmtPanel.style.display = isAdmin ? "block" : "none";
  if (isAdmin) await Promise.all([loadAssignees(), loadUserManagement()]);
  await loadTasks();
}

// ── Screen helpers ────────────────────────────────────────────────────────
function showLoginScreen() {
  $app.style.display = "none"; $loginScreen.style.display = "flex";
  $email.value = $password.value = ""; hideMessages();
}
function showAppScreen(name) {
  $loginScreen.style.display = "none"; $app.style.display = "block";
  $userEmail.textContent = name;
}

// ── Message helpers ───────────────────────────────────────────────────────
function showError(msg)   { $loginError.textContent = msg;   $loginError.style.display = "block";  $loginSuccess.style.display = "none"; }
function showSuccess(msg) { $loginSuccess.textContent = msg; $loginSuccess.style.display = "block"; $loginError.style.display = "none"; }
function hideMessages()   { $loginError.style.display = "none"; $loginSuccess.style.display = "none"; }
function setLoading(btn, on, loadTxt, defTxt) { btn.disabled = on; btn.textContent = on ? loadTxt : defTxt; }
function friendlyAuthError(raw) {
  if (!raw) return "Something went wrong.";
  const r = raw.toLowerCase();
  if (r.includes("invalid login") || r.includes("invalid credentials")) return "Incorrect email or password.";
  if (r.includes("email not confirmed")) return "Please confirm your email first.";
  if (r.includes("too many requests"))   return "Too many attempts — wait a moment.";
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
  if (!tasks.length) { $taskList.innerHTML = `<p class="empty-state">No tasks yet.</p>`; return; }
  $taskList.innerHTML = "";

  tasks.forEach((task) => {
    const isDone      = task.status === "done";
    const assignee    = task.assigneeName || "Unassigned";
    const statusClass = isDone ? "status-done" : "status-pending";
    const statusLabel = isDone ? "Done" : "Pending";
    const photos      = task.proof_photos || [];
    const completedAt = task.completed_at ? new Date(task.completed_at).toLocaleString() : null;

    const card = document.createElement("div");
    card.className = "task-card";
    card.innerHTML = `
      <div class="task-header">
        <span class="task-title${isDone ? " done" : ""}">${escapeHtml(task.title)}</span>
        ${!isDone ? `<button class="btn-done" data-id="${task.id}" data-title="${escapeHtml(task.title)}">
          &#128247; Prove Done
        </button>` : ""}
      </div>
      ${task.notes ? `<p class="task-notes">${escapeHtml(task.notes)}</p>` : ""}
      <div class="task-meta">
        <span class="task-status ${statusClass}">${statusLabel}</span>
        <span class="task-assignee">&#8594; ${escapeHtml(assignee)}</span>
        ${isDone && completedAt ? `<span class="task-completed-at">&#10003; ${completedAt}</span>` : ""}
        ${photos.length ? `<span class="task-photo-count">&#128247; ${photos.length} photo${photos.length > 1 ? "s" : ""}</span>` : ""}
      </div>
      ${isDone && photos.length ? `
        <div class="proof-thumb-row">
          ${photos.map((url) => `<img src="${escapeHtml(url)}" class="proof-thumb-small" />`).join("")}
        </div>` : ""}
    `;

    if (!isDone) {
      card.querySelector(".btn-done").addEventListener("click", (e) => {
        const btn = e.currentTarget;
        openProofModal(btn.dataset.id, btn.dataset.title);
      });
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
      title, notes: notes || null, assigned_to: assignee,
      status: "pending", created_by: currentUser.id,
    });
    if (error) throw error;
    $taskTitle.value = $taskNotes.value = ""; $taskAssignee.value = "";
    await loadTasks();
  } catch (err) { alert("Error: " + err.message); }
  setLoading($createTaskBtn, false, "Creating…", "+ Create Task");
}

// ══════════════════════════════════════════════════════════════════════════
//  PROOF PHOTO SYSTEM
// ══════════════════════════════════════════════════════════════════════════

async function openProofModal(taskId, taskTitle) {
  proofTaskId    = taskId;
  proofTaskTitle = taskTitle;
  capturedPhotos = [];

  $proofTaskName.textContent = taskTitle;
  $proofThumbs.innerHTML     = "";
  $proofError.style.display  = "none";
  $submitProofBtn.style.display = "none";
  $captureBtn.style.display     = "block";
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
    $proofError.textContent  = "Camera access denied. Please allow camera permission and try again.";
    $proofError.style.display = "block";
    $captureBtn.disabled = true;
    console.error("Camera:", err.message);
  }
}

function closeProofModal() {
  stopCamera();
  stopLiveTimestamp();
  $proofModal.style.display = "none";
  capturedPhotos = [];
  proofTaskId    = null;
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  $cameraVideo.srcObject = null;
}

function startLiveTimestamp() {
  const tick = () => {
    $liveTimestamp.textContent = new Date().toLocaleString();
  };
  tick();
  tsInterval = setInterval(tick, 1000);
}

function stopLiveTimestamp() {
  if (tsInterval) { clearInterval(tsInterval); tsInterval = null; }
  $liveTimestamp.textContent = "";
}

function updateProofProgress() {
  const count = capturedPhotos.length;
  const remaining = REQUIRED_PHOTOS - count;

  if (count < REQUIRED_PHOTOS) {
    $progressLabel.textContent    = `Take photo ${count + 1} of ${REQUIRED_PHOTOS}`;
    $proofInstruction.textContent = count === 0
      ? "Point camera at the task area."
      : count === 1
      ? "Move to a different angle for photo 2."
      : "One more photo from another angle.";
    $captureBtn.style.display    = "block";
    $submitProofBtn.style.display = "none";
  } else {
    $progressLabel.textContent    = "All photos captured!";
    $proofInstruction.textContent = "Tap Submit to complete this task.";
    $captureBtn.style.display    = "none";
    $submitProofBtn.style.display = "block";
    // Hide live camera once done
    $cameraVideo.style.display   = "none";
    $liveTimestamp.style.display = "none";
    stopCamera();
    stopLiveTimestamp();
  }

  $dots.forEach((dot, i) => {
    dot.classList.toggle("filled", i < count);
  });
}

function capturePhoto() {
  if (!cameraStream) return;

  const video  = $cameraVideo;
  const canvas = document.createElement("canvas");
  canvas.width  = video.videoWidth  || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d");

  // Draw video frame
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Burn timestamp into bottom of image
  const now       = new Date();
  const tsText    = now.toLocaleString();
  const barH      = Math.round(canvas.height * 0.065);
  const fontSize  = Math.round(barH * 0.55);

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, canvas.height - barH, canvas.width, barH);

  ctx.fillStyle   = "#ffffff";
  ctx.font        = `bold ${fontSize}px 'Space Mono', monospace`;
  ctx.textBaseline = "middle";
  ctx.fillText(`ProofTask  ·  ${tsText}`, 12, canvas.height - barH / 2);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  canvas.toBlob(
    (blob) => {
      capturedPhotos.push({ blob, dataUrl, timestamp: now.toISOString() });

      // Show thumbnail
      const img = document.createElement("img");
      img.src       = dataUrl;
      img.className = "proof-thumb";
      $proofThumbs.appendChild(img);

      updateProofProgress();
    },
    "image/jpeg",
    0.88
  );
}

async function submitProof() {
  if (capturedPhotos.length < REQUIRED_PHOTOS) return;

  setLoading($submitProofBtn, true, "Uploading photos…", "✓ Submit & Complete Task");
  $proofError.style.display = "none";

  try {
    // Upload each photo to Supabase Storage
    const photoUrls = await Promise.all(
      capturedPhotos.map(async ({ blob, timestamp }, index) => {
        const path = `${proofTaskId}/${Date.now()}_${index}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("task-proofs")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw new Error("Upload failed: " + upErr.message);
        const { data: { publicUrl } } = supabase.storage
          .from("task-proofs")
          .getPublicUrl(path);
        return publicUrl;
      })
    );

    // Mark task done with proof
    const { error: updateErr } = await supabase.from("tasks").update({
      status:        "done",
      proof_photos:  photoUrls,
      completed_at:  new Date().toISOString(),
      completed_by:  currentUser.id,
    }).eq("id", proofTaskId);

    if (updateErr) throw updateErr;

    closeProofModal();
    await loadTasks();
  } catch (err) {
    console.error("Submit proof:", err.message);
    $proofError.textContent   = "Failed: " + err.message;
    $proofError.style.display = "block";
    setLoading($submitProofBtn, false, "Uploading photos…", "✓ Submit & Complete Task");
  }
}

// ── Add user (admin) ──────────────────────────────────────────────────────
async function handleAddUser() {
  const name  = $newUserName.value.trim();
  const email = $newUserEmail.value.trim().toLowerCase();
  const pass  = $newUserPassword.value;
  const role  = $newUserRole.value;
  setAddUserMsg("", "");
  if (!name)         { setAddUserMsg("Enter the worker's full name.", "error"); return; }
  if (!email)        { setAddUserMsg("Enter the worker's email.", "error"); return; }
  if (pass.length < 6) { setAddUserMsg("Password must be at least 6 characters.", "error"); return; }
  setLoading($addUserBtn, true, "Adding…", "+ Add Worker");
  try {
    const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data, error: signUpErr } = await tempClient.auth.signUp({ email, password: pass });
    if (signUpErr) throw signUpErr;
    if (data.user) {
      const { error: pErr } = await supabase.from("profiles")
        .upsert({ id: data.user.id, full_name: name, role });
      if (pErr) throw pErr;
    }
    setAddUserMsg(`${name} added successfully!`, "success");
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
  $addUserMsg.textContent = msg;
  $addUserMsg.className   = "add-user-msg " + (type === "success" ? "add-user-success" : "add-user-error");
  $addUserMsg.style.display = "block";
}

// ── User management ───────────────────────────────────────────────────────
async function loadUserManagement() {
  $userList.innerHTML = `<p class="empty-state">Loading users…</p>`;
  try {
    const { data: users, error } = await supabase
      .from("profiles").select("id, full_name, role").order("full_name");
    if (error) throw error;
    if (!users?.length) { $userList.innerHTML = `<p class="empty-state">No users yet.</p>`; return; }
    $userList.innerHTML = "";
    users.forEach(renderUserRow);
  } catch (err) {
    $userList.innerHTML = `<p class="empty-state">Could not load users.</p>`;
  }
}

function renderUserRow(u) {
  const isAdmin = u.role === "admin";
  const isSelf  = u.id === currentUser.id;
  const row = document.createElement("div");
  row.className = "user-row";
  row.innerHTML = `
    <div class="user-row-info">
      <span class="user-row-name">${escapeHtml(u.full_name || "—")}</span>
      <span class="user-role-badge ${isAdmin ? "role-admin" : "role-user"}">${isAdmin ? "Admin" : "User"}</span>
    </div>
    <button class="btn-role-toggle" ${isSelf ? "disabled" : ""}>
      ${isAdmin ? "Demote" : "Promote to Admin"}
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
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    if (error) throw error;
    await Promise.all([loadUserManagement(), loadAssignees()]);
  } catch (err) { alert("Could not update role: " + err.message); }
}

// ── Load assignees ────────────────────────────────────────────────────────
async function loadAssignees() {
  try {
    const { data: users, error } = await supabase
      .from("profiles").select("id, full_name").order("full_name");
    if (error) throw error;
    $taskAssignee.innerHTML = `<option value="">Assign to user (optional)</option>`;
    (users || []).forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id; opt.textContent = u.full_name || u.id;
      $taskAssignee.appendChild(opt);
    });
  } catch (err) { console.warn("Assignees:", err.message); }
}

// ── XSS helper ────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
