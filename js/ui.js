export function renderTasks(tasks) {
  const container = document.getElementById("taskList");
  container.innerHTML = "";
  tasks.forEach(task => {
    const div = document.createElement("div");
    div.className = "task";
    div.innerHTML = `<strong>${task.title}</strong><br/>${task.notes || ""}`;
    container.appendChild(div);
  });
}
