import { loginUser, getUser } from "./auth.js";
import { fetchTasks } from "./tasks.js";
import { renderTasks } from "./ui.js";

window.login = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const user = await loginUser(email, password);
  if (user) {
    document.getElementById("loginView").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    loadTasks();
  }
};

window.loadTasks = async function () {
  const tasks = await fetchTasks();
  renderTasks(tasks);
};

async function init() {
  const user = await getUser();
  if (user) {
    document.getElementById("loginView").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    loadTasks();
  }
}
init();
