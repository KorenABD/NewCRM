/* Tasks page — depends on shared.js */

let taskFilter = "all";

function renderTasks() {
  const taskContact = el("taskContact");
  const currentVal = taskContact.value;
  taskContact.innerHTML = '<option value="">— None —</option>' +
    state.contacts.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || "Untitled")}</option>`).join("");
  taskContact.value = currentVal;

  const allTasks = state.tasks || [];
  const tasks = taskFilter === "pending" ? allTasks.filter((t) => !t.done)
              : taskFilter === "done"    ? allTasks.filter((t) => t.done)
              : allTasks;

  const taskListEl = el("taskList");
  taskListEl.innerHTML = "";

  if (!tasks.length) {
    const msg = taskFilter === "pending" ? "No pending tasks."
              : taskFilter === "done"    ? "No completed tasks."
              : "No tasks yet.";
    taskListEl.innerHTML = `<div class="empty"><p><strong>${msg}</strong></p><p>Add a task above to track follow-ups.</p></div>`;
    return;
  }

  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
  });

  for (const t of sorted) {
    const contact = t.contactId ? state.contacts.find((c) => c.id === t.contactId) : null;
    const card = document.createElement("div");
    card.className = "card task-card" + (t.done ? " task-done" : "");
    card.innerHTML = `
      <div class="task-row">
        <input type="checkbox" class="task-check" ${t.done ? "checked" : ""}>
        <div class="task-body">
          <div class="card-title">${escapeHtml(t.title)}</div>
          <div class="card-sub">
            ${contact ? `<span class="pill">${escapeHtml(contact.name || "Untitled")}</span>` : ""}
            ${t.dueDate ? `<span class="pill">Due ${escapeHtml(t.dueDate)}</span>` : ""}
          </div>
        </div>
        <span class="pill task-del" style="cursor:pointer;border-color:rgba(255,92,106,0.45);color:rgba(255,92,106,0.95)">Delete</span>
      </div>
    `;
    card.querySelector(".task-check").addEventListener("change", (e) => {
      t.done = e.target.checked;
      saveState();
      // Only on completion, not when a task is un-checked (reopened)
      if (t.done) {
        pendo.track("Task Completed", {
          taskId: t.id,
          hasContact: !!t.contactId,
          hasDueDate: !!t.dueDate,
          wasOverdue: !!t.dueDate && t.dueDate < todayISODate(),
          daysToComplete: daysSince(t.createdAt),
          remainingPendingCount: state.tasks.filter((x) => !x.done).length,
        });
      }
      renderTasks();
    });
    card.querySelector(".task-del").addEventListener("click", () => {
      state.tasks = state.tasks.filter((x) => x.id !== t.id);
      saveState();
      pendo.track("Task Deleted", {
        taskId: t.id,
        wasCompleted: !!t.done,
        wasOverdue: !t.done && !!t.dueDate && t.dueDate < todayISODate(),
        hasContact: !!t.contactId,
        hasDueDate: !!t.dueDate,
        remainingTaskCount: state.tasks.length,
      });
      renderTasks();
    });
    taskListEl.appendChild(card);
  }
}

el("taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = el("taskTitle").value.trim();
  if (!title) return;
  state.tasks = state.tasks || [];
  const task = {
    id: uid(),
    title,
    contactId: el("taskContact").value || null,
    dueDate: el("taskDueDate").value || "",
    done: false,
    createdAt: nowISO(),
  };
  state.tasks.unshift(task);
  saveState();
  // Never send the title: it often contains contact names
  pendo.track("Task Created", {
    taskId: task.id,
    hasContact: !!task.contactId,
    contactId: task.contactId,
    hasDueDate: !!task.dueDate,
    daysUntilDue: daysUntil(task.dueDate),
    totalTaskCount: state.tasks.length,
    pendingTaskCount: state.tasks.filter((t) => !t.done).length,
  });
  el("taskForm").reset();
  renderTasks();
});

el("clearCompletedBtn").addEventListener("click", () => {
  const count = (state.tasks || []).filter((t) => t.done).length;
  if (!count) return;
  if (!confirm(`Remove ${count} completed task(s)?`)) return;
  state.tasks = state.tasks.filter((t) => !t.done);
  saveState();
  pendo.track("Completed Tasks Cleared", {
    clearedCount: count,
    remainingTaskCount: state.tasks.length,
  });
  renderTasks();
});

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    taskFilter = btn.dataset.filter;
    document.querySelectorAll(".filter-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.filter === taskFilter)
    );
    renderTasks();
  });
});

setupHeader(renderTasks);
renderTasks();
