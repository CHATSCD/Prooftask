import { fetchTasks } from "./tasks.js";
import { renderTasks } from "./ui.js";

window.loadTasks = async function () {
  const tasks = await fetchTasks();
  renderTasks(tasks);
};
