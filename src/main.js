import "./styles.css";
import { ACTIVITY_TYPE_SUGGESTIONS, CATEGORY_SUGGESTIONS, DEFAULT_OWNER, DISMISS_KEY, PLATFORM_SUGGESTIONS, PRIORITIES, STATUSES, VERTICAL_TEMPLATES } from "./config.js";
import { daysInMonth, endOfWeek, firstOfMonth, lastOfMonth, monthTitle, niceDate, parseDate, shiftDate, shiftMonth, startOfWeek, today, weekDay } from "./dates.js";
import { addActivity, carryForward, createBackup, deleteActivity, getSchedule, isFollowUpDue, progress, restoreBackup, save, state, statusOf, syncRecurrences, uid, updateActivity } from "./store.js";

let viewMode = "month";
let monthStart = firstOfMonth();
let weekStart = startOfWeek();
let selectedDate = today();
let ownerFilter = "All";
let verticalFilter = "All";
let statusFilter = "All";
let reminderShown = false;

const app = document.querySelector("#app");
const overlay = document.querySelector("#overlay");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const priorityClass = (priority) => String(priority || "Medium").toLowerCase();
const statusClass = (activity) => statusOf(activity).toLowerCase().replace(" ", "-");
const isCarried = (activity) => activity.history.some((entry) => entry.type === "carried" || entry.from);

function filteredActivities() {
  return state.activities.filter((activity) => {
    if (ownerFilter !== "All" && activity.owner !== ownerFilter) return false;
    if (verticalFilter !== "All" && activity.vertical !== verticalFilter) return false;
    if (statusFilter !== "All" && statusOf(activity) !== statusFilter) return false;
    return true;
  });
}

function commandMetrics() {
  const activities = filteredActivities();
  const current = today();
  return {
    today: activities.filter((activity) => activity.date === current && progress(activity) < 100),
    pending: activities.filter((activity) => activity.date <= current && progress(activity) < 100),
    followUps: activities.filter(isFollowUpDue),
    completed: activities.filter((activity) => activity.date === current && progress(activity) === 100),
  };
}

function optionList(values, selected, includeAll = false) {
  return `${includeAll ? `<option ${selected === "All" ? "selected" : ""}>All</option>` : ""}${values.map((value) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}`;
}

function ensureVisibleRecurrences() {
  const anchor = viewMode === "month" ? monthStart : endOfWeek(weekStart);
  syncRecurrences(lastOfMonth(shiftMonth(firstOfMonth(anchor), 2)));
}

function render() {
  ensureVisibleRecurrences();
  app.innerHTML = `<div class="app-shell">
    <header class="app-header">
      <div class="brand-lockup"><div class="brand-mark">W</div><div><div class="eyebrow">Business Development Command Centre</div><h1>Webster WAVE</h1><p class="subtitle">Actions, visibility and execution across one connected planning system.</p></div></div>
      <div class="header-actions"><button class="button reminder-preview" id="previewReminder">☀ Morning briefing</button><button class="button" id="openDataTools">↕ Backup & restore</button><button class="button primary" id="addTop">＋ Add activity</button></div>
    </header>
    <section class="command-strip" id="commandStrip" aria-label="Daily command centre"></section>
    <section class="control-bar">
      <div class="view-switch" aria-label="Calendar view"><button class="${viewMode === "month" ? "active" : ""}" data-view="month">Monthly Calendar</button><button class="${viewMode === "week" ? "active" : ""}" data-view="week">Weekly Planner</button></div>
      <div class="filters"><label>Vertical<select id="verticalFilter">${optionList(state.verticals, verticalFilter, true)}</select></label><label>Status<select id="statusFilter">${optionList(STATUSES, statusFilter, true)}</select></label><label>Assigned<select id="ownerFilter">${optionList(state.team, ownerFilter, true)}</select></label><button class="clear-filters ${ownerFilter === "All" && verticalFilter === "All" && statusFilter === "All" ? "hidden" : ""}" id="clearFilters">Clear</button></div>
    </section>
    <main id="viewRoot"></main>
    <footer class="footer"><span>One shared activity system · Monthly and weekly views stay synchronized</span><span>Saved privately in this browser</span></footer>
  </div>`;

  renderCommandStrip();
  if (viewMode === "month") renderMonthView(); else renderWeekView();
  bindShellEvents();
}

function bindShellEvents() {
  document.querySelector("#addTop").addEventListener("click", () => showActivityForm(null, selectedDate));
  document.querySelector("#previewReminder").addEventListener("click", () => showReminder(true));
  document.querySelector("#openDataTools").addEventListener("click", showDataTools);
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
    viewMode = button.dataset.view;
    if (viewMode === "month") monthStart = firstOfMonth(selectedDate);
    else weekStart = startOfWeek(selectedDate);
    render();
  }));
  document.querySelector("#verticalFilter").addEventListener("change", (event) => { verticalFilter = event.target.value; render(); });
  document.querySelector("#statusFilter").addEventListener("change", (event) => { statusFilter = event.target.value; render(); });
  document.querySelector("#ownerFilter").addEventListener("change", (event) => { ownerFilter = event.target.value; render(); });
  document.querySelector("#clearFilters")?.addEventListener("click", () => { ownerFilter = "All"; verticalFilter = "All"; statusFilter = "All"; render(); });
}

function renderCommandStrip() {
  const metrics = commandMetrics();
  const cards = [["today", "Today", metrics.today.length, "Activities to execute"], ["pending", "Pending", metrics.pending.length, "Open through today"], ["followups", "Follow-ups", metrics.followUps.length, "Due for attention"], ["completed", "Completed", metrics.completed.length, "Finished today"]];
  document.querySelector("#commandStrip").innerHTML = `<div class="command-intro"><span class="pulse"></span><div><strong>${weekDay(today())}, ${niceDate(today())}</strong><small>Live daily execution overview</small></div></div><div class="metric-grid">${cards.map(([key, label, count, help]) => `<button class="metric-card ${key}" data-metric="${key}"><span class="metric-label">${label}</span><strong>${count}</strong><small>${help}</small></button>`).join("")}</div>`;
  document.querySelectorAll("[data-metric]").forEach((button) => button.addEventListener("click", () => { selectedDate = today(); monthStart = firstOfMonth(); weekStart = startOfWeek(); render(); }));
}

function renderMonthView() {
  const root = document.querySelector("#viewRoot");
  root.innerHTML = `<div class="workspace">
    <section class="panel calendar-panel"><div class="panel-inner"><div class="panel-header"><div><div class="section-kicker">Monthly execution calendar</div><h2>${monthTitle(monthStart)}</h2><div class="small">${niceDate(monthStart)} – ${niceDate(lastOfMonth(monthStart), { year: "numeric" })}</div></div><div class="period-actions"><button class="button icon-button" id="previousPeriod">‹</button><button class="button today-button" id="currentPeriod">This month</button><button class="button icon-button" id="nextPeriod">›</button></div></div><div class="calendar-grid" id="calendar"></div><div class="legend"><span><i class="legend-mark scheduled"></i> Scheduled</span><span><i class="legend-mark progress"></i> In progress</span><span><i class="legend-mark completed"></i> Completed</span><span><i class="legend-mark carried"></i> Carried forward</span><span><i class="legend-mark recurring"></i> Recurring</span></div></div></section>
    <section class="panel day-panel"><div class="panel-inner"><div class="panel-header day-header"><div><div class="eyebrow" id="selectedWeekday"></div><div class="date-heading" id="selectedDate"></div><div class="small" id="activityCount"></div></div><button class="button compact" id="addDay">＋ Add</button></div><div class="day-progress" id="dayProgress"></div><div class="activity-list" id="activityList"></div></div></section>
  </div>`;
  renderCalendarGrid();
  renderSelectedDay();
  document.querySelector("#previousPeriod").addEventListener("click", () => { monthStart = shiftMonth(monthStart, -1); selectedDate = monthStart; render(); });
  document.querySelector("#nextPeriod").addEventListener("click", () => { monthStart = shiftMonth(monthStart, 1); selectedDate = monthStart; render(); });
  document.querySelector("#currentPeriod").addEventListener("click", () => { monthStart = firstOfMonth(); selectedDate = today(); render(); });
  document.querySelector("#addDay").addEventListener("click", () => showActivityForm(null, selectedDate));
}

function renderCalendarGrid() {
  const activities = filteredActivities();
  const first = parseDate(monthStart);
  const offset = (first.getDay() + 6) % 7;
  let html = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => `<div class="weekday">${day}</div>`).join("");
  html += Array.from({ length: offset }, () => '<div class="calendar-spacer"></div>').join("");
  for (let index = 0; index < daysInMonth(monthStart); index += 1) {
    const date = shiftDate(monthStart, index);
    const dayItems = activities.filter((activity) => activity.date === date);
    const completed = dayItems.filter((activity) => progress(activity) === 100).length;
    const average = dayItems.length ? Math.round(dayItems.reduce((sum, activity) => sum + progress(activity), 0) / dayItems.length) : 0;
    const high = dayItems.some((activity) => activity.priority === "High" && progress(activity) < 100);
    const carried = dayItems.some(isCarried);
    const recurring = dayItems.some((activity) => activity.recurrenceId);
    html += `<button class="day ${selectedDate === date ? "selected" : ""} ${today() === date ? "today" : ""} ${carried ? "has-carried" : ""}" data-date="${date}"><span class="day-top"><span class="day-number">${parseDate(date).getDate()}</span>${high ? '<i class="priority-pin"></i>' : ""}${recurring ? '<i class="recurring-pin">↻</i>' : ""}</span>${dayItems.length ? `<span class="day-count"><b>${dayItems.length}</b> ${dayItems.length === 1 ? "activity" : "activities"}</span><span class="mini-progress"><i style="width:${average}%"></i></span><span class="day-summary">${completed}/${dayItems.length} done · ${average}%</span>` : '<span class="day-empty">Open</span>'}</button>`;
  }
  const calendar = document.querySelector("#calendar");
  calendar.innerHTML = html;
  calendar.querySelectorAll("[data-date]").forEach((button) => button.addEventListener("click", () => { selectedDate = button.dataset.date; render(); }));
}

function activityCard(activity) {
  const value = progress(activity);
  return `<button class="activity-card ${value === 100 ? "is-complete" : ""}" data-activity="${activity.id}"><span class="activity-accent ${priorityClass(activity.priority)}"></span><span class="activity-content"><span class="activity-top"><strong class="activity-title">${escapeHtml(activity.title)}</strong><span class="status-pill ${statusClass(activity)}">${statusOf(activity)}</span></span><span class="activity-meta"><span>${escapeHtml(activity.vertical)}</span>${activity.platform ? `<span>· ${escapeHtml(activity.platform)}</span>` : ""}<span class="owner-avatar">${escapeHtml(activity.owner.charAt(0).toUpperCase())}</span><span>${escapeHtml(activity.owner)}</span>${activity.recurrenceId ? '<span class="recurrence-tag">↻ Recurring</span>' : ""}${isCarried(activity) ? '<span class="carried-tag">↗ Carried</span>' : ""}${isFollowUpDue(activity) ? '<span class="followup-tag">Follow-up due</span>' : ""}</span><span class="progress-row"><span class="progress-track"><i class="progress-fill" style="width:${value}%"></i></span><span class="progress-value">${value}%</span><span class="card-arrow">›</span></span></span></button>`;
}

function renderSelectedDay() {
  const activities = filteredActivities().filter((activity) => activity.date === selectedDate).sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
  document.querySelector("#selectedWeekday").textContent = selectedDate === today() ? "Today" : weekDay(selectedDate);
  document.querySelector("#selectedDate").textContent = niceDate(selectedDate, { year: "numeric" });
  document.querySelector("#activityCount").textContent = `${activities.length} ${activities.length === 1 ? "activity" : "activities"}`;
  const average = activities.length ? Math.round(activities.reduce((sum, activity) => sum + progress(activity), 0) / activities.length) : 0;
  document.querySelector("#dayProgress").innerHTML = activities.length ? `<div><span>Day progress</span><strong>${average}%</strong></div><div class="progress-track"><i class="progress-fill" style="width:${average}%"></i></div>` : "";
  const list = document.querySelector("#activityList");
  list.innerHTML = activities.length ? activities.map(activityCard).join("") : `<div class="empty-state"><div class="empty-icon">＋</div><strong>Clear runway</strong><span>Nothing planned for this day.</span><button class="text-button" id="emptyAdd">Add an activity</button></div>`;
  list.querySelectorAll("[data-activity]").forEach((button) => button.addEventListener("click", () => showActivityDetail(button.dataset.activity)));
  document.querySelector("#emptyAdd")?.addEventListener("click", () => showActivityForm(null, selectedDate));
}

function renderWeekView() {
  const end = endOfWeek(weekStart);
  const activities = filteredActivities();
  const dates = Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index));
  const rows = dates.map((date) => {
    const dayItems = activities.filter((activity) => activity.date === date).sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
    const list = dayItems.length ? dayItems : [null];
    return list.map((activity, index) => `<tr class="${activity ? "planner-row" : "empty-row"}" ${activity ? `data-activity="${activity.id}"` : ""}>${index === 0 ? `<td class="day-cell" rowspan="${list.length}"><strong>${weekDay(date, true)}</strong><span>${niceDate(date)}</span>${date === today() ? '<em>Today</em>' : ""}<button class="row-add" data-add-date="${date}" title="Add activity">＋</button></td>` : ""}${activity ? `<td data-label="Platform">${escapeHtml(activity.platform || "—")}</td><td data-label="Activity type">${escapeHtml(activity.activityType || "—")}</td><td data-label="Category">${escapeHtml(activity.category || activity.vertical)}</td><td class="topic-cell" data-label="Topic / activity"><strong>${escapeHtml(activity.topic || activity.title)}</strong>${activity.topic ? `<small>${escapeHtml(activity.title)}</small>` : ""}</td><td data-label="Assigned"><span class="assigned-person"><i>${escapeHtml(activity.owner.charAt(0).toUpperCase())}</i>${escapeHtml(activity.owner)}</span></td><td class="details-cell" data-label="Additional details">${escapeHtml(activity.additionalDetails || activity.notes || "—")}</td><td data-label="Progress"><span class="table-status ${statusClass(activity)}">${statusOf(activity)}</span><span class="table-progress"><i style="width:${progress(activity)}%"></i></span><small>${progress(activity)}%</small></td>` : `<td colspan="7" class="empty-week-cell"><span>No activity planned</span><button data-add-date="${date}">＋ Add activity</button></td>`}</tr>`).join("");
  }).join("");
  document.querySelector("#viewRoot").innerHTML = `<section class="panel weekly-panel"><div class="panel-inner"><div class="panel-header"><div><div class="section-kicker">Spreadsheet-inspired execution plan</div><h2>Week of ${niceDate(weekStart)}</h2><div class="small">${niceDate(weekStart)} – ${niceDate(end, { year: "numeric" })}</div></div><div class="period-actions"><button class="button icon-button" id="previousWeek">‹</button><button class="button today-button" id="currentWeek">This week</button><button class="button icon-button" id="nextWeek">›</button></div></div><div class="weekly-table-wrap"><table class="weekly-table"><thead><tr><th>Day</th><th>Platform</th><th>Activity type</th><th>Category</th><th>Topic / Activity</th><th>Assigned</th><th>Additional details</th><th>Progress</th></tr></thead><tbody>${rows}</tbody></table></div><div class="weekly-summary"><span>${activities.filter((activity) => activity.date >= weekStart && activity.date <= end).length} activities this week</span><span>Click any row to open its workspace</span></div></div></section>`;
  document.querySelector("#previousWeek").addEventListener("click", () => { weekStart = shiftDate(weekStart, -7); selectedDate = weekStart; render(); });
  document.querySelector("#nextWeek").addEventListener("click", () => { weekStart = shiftDate(weekStart, 7); selectedDate = weekStart; render(); });
  document.querySelector("#currentWeek").addEventListener("click", () => { weekStart = startOfWeek(); selectedDate = today(); render(); });
  document.querySelectorAll("[data-add-date]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); showActivityForm(null, button.dataset.addDate); }));
  document.querySelectorAll(".planner-row[data-activity]").forEach((row) => row.addEventListener("click", () => showActivityDetail(row.dataset.activity)));
}

function openModal(content, drawer = false) {
  overlay.innerHTML = content;
  overlay.className = `overlay ${drawer ? "drawer-overlay" : ""}`;
  overlay.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModal));
  overlay.addEventListener("click", closeOnBackdrop, { once: true });
  document.addEventListener("keydown", closeOnEscape);
}
function closeOnBackdrop(event) { if (event.target === overlay) closeModal(); }
function closeOnEscape(event) { if (event.key === "Escape") closeModal(); }
function closeModal() { overlay.className = "overlay hidden"; overlay.innerHTML = ""; document.removeEventListener("keydown", closeOnEscape); }

function resourceLinks(value) {
  const lines = String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return '<p class="empty-copy">No resources added.</p>';
  return `<div class="resource-list">${lines.map((line) => /^https?:\/\//i.test(line) ? `<a href="${escapeHtml(line)}" target="_blank" rel="noopener">↗ ${escapeHtml(line.replace(/^https?:\/\//, ""))}</a>` : `<span>• ${escapeHtml(line)}</span>`).join("")}</div>`;
}

function attachmentList(attachments) {
  if (!attachments.length) return '<p class="empty-copy">No attachments added.</p>';
  return `<div class="attachment-list">${attachments.map((file) => `<a href="${escapeHtml(file.data)}" download="${escapeHtml(file.name)}"><span>↧</span><div><strong>${escapeHtml(file.name)}</strong><small>${file.size ? `${Math.ceil(file.size / 1024)} KB` : "Local attachment"}</small></div></a>`).join("")}</div>`;
}

function showActivityDetail(id) {
  const activity = state.activities.find((item) => item.id === id);
  if (!activity) return;
  const value = progress(activity);
  const completed = activity.items.filter((item) => item.done).length;
  const schedule = getSchedule(activity);
  const carried = activity.history.filter((entry) => entry.type === "carried" || entry.from);
  const checklist = activity.items.length ? activity.items.map((item, index) => `<label class="check-row ${item.done ? "done" : ""}"><input type="checkbox" data-check="${index}" ${item.done ? "checked" : ""}/><span>${escapeHtml(item.label)}</span></label>`).join("") : `<label class="check-row"><input type="checkbox" id="manualComplete" ${activity.manualDone ? "checked" : ""}/><span>Mark activity complete</span></label>`;
  openModal(`<aside class="activity-drawer" role="dialog" aria-modal="true"><header class="drawer-head"><div><div class="eyebrow">${escapeHtml(activity.vertical)}</div><h2>${escapeHtml(activity.title)}</h2></div><button class="close-button" data-close>×</button></header><div class="drawer-badges"><span class="priority-badge ${priorityClass(activity.priority)}">${escapeHtml(activity.priority)} priority</span><span class="status-pill ${statusClass(activity)}">${statusOf(activity)}</span>${schedule ? `<span class="recurrence-tag">↻ ${escapeHtml(schedule.frequency)}</span>` : ""}${isCarried(activity) ? '<span class="carried-tag">↗ Carried forward</span>' : ""}</div>
    <div class="detail-grid"><div><span>Scheduled</span><strong>${niceDate(activity.date, { year: "numeric" })}</strong></div><div><span>Assigned</span><strong>${escapeHtml(activity.owner)}</strong></div><div><span>Platform</span><strong>${escapeHtml(activity.platform || "Not set")}</strong></div><div><span>Activity type</span><strong>${escapeHtml(activity.activityType || "Not set")}</strong></div><div><span>Category</span><strong>${escapeHtml(activity.category || "Not set")}</strong></div><div><span>Follow-up</span><strong>${activity.followUpDate ? niceDate(activity.followUpDate, { year: "numeric" }) : "Not set"}</strong></div></div>
    ${activity.topic || activity.additionalDetails ? `<section class="context-card">${activity.topic ? `<div><span>Topic</span><strong>${escapeHtml(activity.topic)}</strong></div>` : ""}${activity.additionalDetails ? `<p>${escapeHtml(activity.additionalDetails).replace(/\n/g, "<br>")}</p>` : ""}</section>` : ""}
    <section class="progress-hero"><div><span>Overall progress</span><strong>${value}%</strong></div><div class="progress-track"><i class="progress-fill" style="width:${value}%"></i></div><small>${completed} of ${activity.items.length || 1} steps complete</small></section>
    <section class="drawer-section"><div class="section-title"><h3>Execution checklist</h3><span>${completed}/${activity.items.length}</span></div><div class="checklist">${checklist}</div></section>
    <section class="drawer-section"><div class="section-title"><h3>Notes</h3></div>${activity.notes ? `<p class="notes-copy">${escapeHtml(activity.notes).replace(/\n/g, "<br>")}</p>` : '<p class="empty-copy">No notes added.</p>'}</section>
    <section class="drawer-section"><div class="section-title"><h3>Attachments</h3><span>${activity.attachments.length}</span></div>${attachmentList(activity.attachments)}</section>
    <section class="drawer-section"><div class="section-title"><h3>Resources</h3></div>${resourceLinks(activity.resources)}</section>
    <section class="drawer-section"><div class="section-title"><h3>Outcome</h3></div>${activity.outcome ? `<p class="notes-copy">${escapeHtml(activity.outcome).replace(/\n/g, "<br>")}</p>` : '<p class="empty-copy">No outcome recorded yet.</p>'}</section>
    ${activity.followUpDate ? `<label class="followup-check ${activity.followUpDone ? "done" : ""}"><input type="checkbox" id="followUpDone" ${activity.followUpDone ? "checked" : ""}/><span><strong>Follow-up ${activity.followUpDone ? "completed" : "tracked"}</strong><small>${niceDate(activity.followUpDate, { year: "numeric" })}</small></span></label>` : ""}
    ${carried.length ? `<section class="drawer-section activity-history"><div class="section-title"><h3>Rescheduling history</h3></div>${carried.slice(-4).reverse().map((entry) => `<p>Moved from ${niceDate(entry.from)} to ${niceDate(entry.to)}</p>`).join("")}</section>` : ""}
    <div class="drawer-actions"><button class="button ghost-danger" id="deleteActivity">Delete</button>${schedule ? '<button class="button ghost-danger" id="deleteSeries">Delete series</button>' : ""}<button class="button" id="editActivity">Edit</button><button class="button primary" data-close>Done</button></div>
  </aside>`, true);
  overlay.querySelectorAll("[data-check]").forEach((checkbox) => checkbox.addEventListener("change", () => { activity.items[Number(checkbox.dataset.check)].done = checkbox.checked; activity.updatedAt = new Date().toISOString(); save(); render(); showActivityDetail(id); }));
  overlay.querySelector("#manualComplete")?.addEventListener("change", (event) => { activity.manualDone = event.target.checked; save(); render(); showActivityDetail(id); });
  overlay.querySelector("#followUpDone")?.addEventListener("change", (event) => { activity.followUpDone = event.target.checked; save(); render(); showActivityDetail(id); });
  overlay.querySelector("#editActivity").addEventListener("click", () => showActivityForm(id));
  overlay.querySelector("#deleteActivity").addEventListener("click", () => { if (!window.confirm("Delete this occurrence?")) return; deleteActivity(id); closeModal(); render(); });
  overlay.querySelector("#deleteSeries")?.addEventListener("click", () => { if (!window.confirm("Delete this recurring schedule and all its occurrences?")) return; deleteActivity(id, "series"); closeModal(); render(); });
}

function fieldSelect(label, id, values, selected, newLabel) {
  return `<label class="field">${label}<select id="${id}">${values.map((value) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}<option value="__new__">＋ ${newLabel}</option></select><input id="${id}New" class="hidden" placeholder="Enter ${label.toLowerCase()}"/></label>`;
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: uid(), name: file.name, type: file.type, size: file.size, data: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downloadBackup() {
  const backup = createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `webster-wave-backup-${today()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function showDataTools() {
  openModal(`<article class="modal data-modal" role="dialog" aria-modal="true"><header class="modal-head"><div><div class="eyebrow">Data safety</div><h2>Backup & restore</h2><p class="modal-description">Keep a portable copy of the full WAVE plan, including recurring schedules and local attachments.</p></div><button class="close-button" data-close>×</button></header>
    <div class="data-summary"><div><strong>${state.activities.length}</strong><span>Activities</span></div><div><strong>${state.recurrences.length}</strong><span>Recurring schedules</span></div><div><strong>${state.team.length}</strong><span>Owners</span></div></div>
    <section class="data-action"><div><strong>Download a complete backup</strong><p>Save a dated JSON file that can restore this browser or move the plan to another device.</p></div><button class="button primary" id="downloadBackup">Download backup</button></section>
    <section class="data-action restore-action"><div><strong>Restore from a backup</strong><p>Choose a WAVE JSON backup. The file is checked before your current plan is replaced.</p></div><label class="button file-button">Choose backup<input id="restoreInput" type="file" accept="application/json,.json"/></label></section>
    <div class="restore-preview hidden" id="restorePreview"></div><p class="form-error hidden" id="restoreError"></p>
  </article>`);
  overlay.querySelector("#downloadBackup").addEventListener("click", downloadBackup);
  overlay.querySelector("#restoreInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const error = overlay.querySelector("#restoreError");
    const preview = overlay.querySelector("#restorePreview");
    error.classList.add("hidden"); preview.classList.add("hidden");
    try {
      if (file.size > 25_000_000) throw new Error("This backup is larger than the 25 MB restore limit.");
      const backup = JSON.parse(await file.text());
      const source = backup?.format === "webster-wave-backup" ? backup.data : backup;
      if (!source || !Array.isArray(source.activities)) throw new Error("This file does not contain a valid WAVE plan.");
      preview.innerHTML = `<div><strong>${source.activities.length}</strong><span>activities found in ${escapeHtml(file.name)}</span></div><button class="button primary" id="confirmRestore">Replace current plan</button>`;
      preview.classList.remove("hidden");
      overlay.querySelector("#confirmRestore").addEventListener("click", () => {
        if (!window.confirm(`Replace the current WAVE plan with ${source.activities.length} activities from this backup? Download a backup first if you may need the current data.`)) return;
        try {
          restoreBackup(backup);
          ownerFilter = "All"; verticalFilter = "All"; statusFilter = "All";
          selectedDate = today(); monthStart = firstOfMonth(); weekStart = startOfWeek();
          closeModal(); render();
        } catch (restoreError) {
          error.textContent = restoreError.message || "The backup could not be restored.";
          error.classList.remove("hidden");
        }
      });
    } catch (fileError) {
      error.textContent = fileError instanceof SyntaxError ? "This is not a readable JSON backup." : (fileError.message || "The backup could not be read.");
      error.classList.remove("hidden");
    } finally { event.target.value = ""; }
  });
}

function showActivityForm(id = null, defaultDate = selectedDate) {
  const activity = id ? state.activities.find((item) => item.id === id) : null;
  const schedule = getSchedule(activity);
  const editing = Boolean(activity);
  let draftItems = activity ? activity.items.map((item) => ({ ...item })) : VERTICAL_TEMPLATES.Marketing.map((label) => ({ id: uid(), label, done: false }));
  let draftAttachments = activity ? activity.attachments.map((file) => ({ ...file })) : [];
  const recurrenceFrequency = schedule?.frequency || "none";
  const recurringWeekdays = schedule?.weekdays || [];
  openModal(`<article class="modal form-modal wide-form" role="dialog" aria-modal="true"><header class="modal-head"><div><div class="eyebrow">${editing ? "Edit activity" : "New activity"}</div><h2>${editing ? "Update the plan" : "Plan an activity"}</h2><p class="modal-description">Monthly and weekly views update from this same activity record.</p></div><button class="close-button" data-close>×</button></header>
    <form class="form activity-form" id="activityForm">
      <label class="field span-2">Activity title<input id="activityTitle" required maxlength="120" placeholder="What needs to happen?" value="${escapeHtml(activity?.title || "")}"/></label>
      ${fieldSelect("Vertical", "activityVertical", state.verticals, activity?.vertical || "Marketing", "Add new vertical…")}
      ${fieldSelect("Assigned person", "activityOwner", state.team, activity?.owner || DEFAULT_OWNER, "Add new person…")}
      <label class="field">Scheduled date<input id="activityDate" type="date" required value="${activity?.date || defaultDate}"/></label>
      <label class="field">Priority<select id="activityPriority">${PRIORITIES.map((priority) => `<option ${activity?.priority === priority || (!activity && priority === "Medium") ? "selected" : ""}>${priority}</option>`).join("")}</select></label>
      <label class="field">Platform<input id="activityPlatform" list="platformSuggestions" maxlength="60" placeholder="e.g. LinkedIn" value="${escapeHtml(activity?.platform || "")}"/><datalist id="platformSuggestions">${PLATFORM_SUGGESTIONS.map((value) => `<option value="${value}">`).join("")}</datalist></label>
      <label class="field">Activity type<input id="activityType" list="typeSuggestions" maxlength="60" placeholder="e.g. Post, call, meeting" value="${escapeHtml(activity?.activityType || "")}"/><datalist id="typeSuggestions">${ACTIVITY_TYPE_SUGGESTIONS.map((value) => `<option value="${value}">`).join("")}</datalist></label>
      <label class="field">Category<input id="activityCategory" list="categorySuggestions" maxlength="60" placeholder="e.g. Lead generation" value="${escapeHtml(activity?.category || "")}"/><datalist id="categorySuggestions">${CATEGORY_SUGGESTIONS.map((value) => `<option value="${value}">`).join("")}</datalist></label>
      <label class="field">Topic<input id="activityTopic" maxlength="120" placeholder="Campaign or conversation topic" value="${escapeHtml(activity?.topic || "")}"/></label>
      <label class="field span-2">Additional details<textarea id="additionalDetails" rows="3" placeholder="Brief, deliverable, talking points or instructions">${escapeHtml(activity?.additionalDetails || "")}</textarea></label>
      <label class="field">Follow-up date<input id="followUpDate" type="date" value="${activity?.followUpDate || ""}"/></label>
      <label class="inline-check fixed-field"><input id="fixedDate" type="checkbox" ${activity?.fixed ? "checked" : ""}/><span><strong>Fixed date</strong><small>Never move automatically</small></span></label>
      <section class="form-section span-2"><div class="section-title"><h3>Recurrence</h3><span>Fresh checklist for every occurrence</span></div><div class="recurrence-grid"><label class="field">Repeat<select id="recurrenceFrequency"><option value="none" ${recurrenceFrequency === "none" ? "selected" : ""}>Does not repeat</option><option value="weekly" ${recurrenceFrequency === "weekly" ? "selected" : ""}>Weekly</option><option value="monthly" ${recurrenceFrequency === "monthly" ? "selected" : ""}>Monthly</option><option value="weekdays" ${recurrenceFrequency === "weekdays" ? "selected" : ""}>Specific weekdays</option></select></label><label class="field">End date (optional)<input id="recurrenceUntil" type="date" value="${schedule?.until || ""}"/></label>${schedule ? `<label class="field">Apply changes<select id="editScope"><option value="occurrence">This occurrence only</option><option value="series">This and future schedule</option></select></label>` : ""}</div><div class="weekday-picker ${recurrenceFrequency === "weekdays" ? "" : "hidden"}" id="weekdayPicker">${[[1,"Mon"],[2,"Tue"],[3,"Wed"],[4,"Thu"],[5,"Fri"],[6,"Sat"],[0,"Sun"]].map(([value,label]) => `<label><input type="checkbox" value="${value}" ${recurringWeekdays.includes(value) ? "checked" : ""}/><span>${label}</span></label>`).join("")}</div></section>
      <label class="field span-2">Notes<textarea id="activityNotes" rows="3" placeholder="Internal context and working notes">${escapeHtml(activity?.notes || "")}</textarea></label>
      <label class="field span-2">Outcome<textarea id="activityOutcome" rows="2" placeholder="Result, response or next decision">${escapeHtml(activity?.outcome || "")}</textarea></label>
      <label class="field span-2">Resource links<textarea id="activityResources" rows="2" placeholder="One link or reference per line">${escapeHtml(activity?.resources || "")}</textarea></label>
      <section class="form-section span-2"><div class="section-title"><h3>Attachments</h3><span>Stored locally · 1.5 MB each / 3 MB total</span></div><label class="file-input">＋ Add files<input id="attachmentInput" type="file" multiple/></label><div id="attachmentEditor"></div><p class="form-error hidden" id="attachmentError"></p></section>
      <section class="form-section span-2"><div class="section-title checklist-heading"><h3>Checklist</h3><span id="stepCount"></span></div><div id="checklistEditor"></div><button class="new-check" id="addChecklistItem" type="button">＋ Add checklist step</button></section>
      <div class="form-actions span-2"><button class="button" type="button" data-close>Cancel</button><button class="button primary" type="submit">${editing ? "Save changes" : "Add activity"}</button></div>
    </form></article>`);

  const verticalSelect = overlay.querySelector("#activityVertical");
  const ownerSelect = overlay.querySelector("#activityOwner");
  const recurrenceSelect = overlay.querySelector("#recurrenceFrequency");
  const checklistEditor = overlay.querySelector("#checklistEditor");
  const attachmentEditor = overlay.querySelector("#attachmentEditor");

  function setupCustomSelect(select, onKnownValue) {
    const input = overlay.querySelector(`#${select.id}New`);
    select.addEventListener("change", () => {
      const adding = select.value === "__new__";
      input.classList.toggle("hidden", !adding);
      input.required = adding;
      if (adding) input.focus(); else onKnownValue?.(select.value);
    });
    return () => select.value === "__new__" ? input.value.trim() : select.value;
  }
  const getVertical = setupCustomSelect(verticalSelect, (value) => {
    const template = VERTICAL_TEMPLATES[value];
    if (!template) return;
    if (editing && !window.confirm("Replace this checklist with the selected vertical’s template?")) return;
    draftItems = template.map((label) => ({ id: uid(), label, done: false }));
    drawChecklist();
  });
  const getOwner = setupCustomSelect(ownerSelect);

  function drawChecklist() {
    overlay.querySelector("#stepCount").textContent = `${draftItems.length} steps`;
    checklistEditor.innerHTML = draftItems.map((item, index) => `<div class="check-edit"><span>${index + 1}</span><input data-check-input="${index}" value="${escapeHtml(item.label)}"/><button data-remove-check="${index}" type="button">×</button></div>`).join("");
    checklistEditor.querySelectorAll("[data-check-input]").forEach((input) => input.addEventListener("input", () => { draftItems[Number(input.dataset.checkInput)].label = input.value; }));
    checklistEditor.querySelectorAll("[data-remove-check]").forEach((button) => button.addEventListener("click", () => { draftItems.splice(Number(button.dataset.removeCheck), 1); drawChecklist(); }));
  }
  function drawAttachments() {
    attachmentEditor.innerHTML = draftAttachments.length ? `<div class="attachment-editor">${draftAttachments.map((file, index) => `<div><span>▣</span><strong>${escapeHtml(file.name)}</strong><small>${Math.ceil(file.size / 1024)} KB</small><button type="button" data-remove-file="${index}">×</button></div>`).join("")}</div>` : '<p class="empty-copy">No files selected.</p>';
    attachmentEditor.querySelectorAll("[data-remove-file]").forEach((button) => button.addEventListener("click", () => { draftAttachments.splice(Number(button.dataset.removeFile), 1); drawAttachments(); }));
  }
  drawChecklist(); drawAttachments();
  overlay.querySelector("#addChecklistItem").addEventListener("click", () => { draftItems.push({ id: uid(), label: "", done: false }); drawChecklist(); checklistEditor.querySelector(`[data-check-input="${draftItems.length - 1}"]`)?.focus(); });
  recurrenceSelect.addEventListener("change", () => { overlay.querySelector("#weekdayPicker").classList.toggle("hidden", recurrenceSelect.value !== "weekdays"); });
  overlay.querySelector("#attachmentInput").addEventListener("change", async (event) => {
    const error = overlay.querySelector("#attachmentError"); error.classList.add("hidden");
    for (const file of event.target.files) {
      if (file.size > 1_500_000) { error.textContent = `${file.name} is larger than 1.5 MB.`; error.classList.remove("hidden"); continue; }
      if (draftAttachments.reduce((sum, item) => sum + item.size, 0) + file.size > 3_000_000) { error.textContent = "Attachments for one activity are limited to 3 MB in total."; error.classList.remove("hidden"); continue; }
      draftAttachments.push(await readFile(file));
    }
    event.target.value = ""; drawAttachments();
  });
  overlay.querySelector("#activityForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const vertical = getVertical(); const owner = getOwner();
    if (!vertical || !owner) return;
    const payload = {
      title: overlay.querySelector("#activityTitle").value.trim(), vertical, owner,
      date: overlay.querySelector("#activityDate").value, priority: overlay.querySelector("#activityPriority").value,
      platform: overlay.querySelector("#activityPlatform").value.trim(), activityType: overlay.querySelector("#activityType").value.trim(),
      category: overlay.querySelector("#activityCategory").value.trim(), topic: overlay.querySelector("#activityTopic").value.trim(),
      additionalDetails: overlay.querySelector("#additionalDetails").value.trim(), notes: overlay.querySelector("#activityNotes").value.trim(),
      outcome: overlay.querySelector("#activityOutcome").value.trim(), resources: overlay.querySelector("#activityResources").value.trim(),
      followUpDate: overlay.querySelector("#followUpDate").value, fixed: overlay.querySelector("#fixedDate").checked,
      attachments: draftAttachments, items: draftItems.filter((item) => item.label.trim()).map((item) => ({ ...item, label: item.label.trim() })),
    };
    const recurrence = { frequency: recurrenceSelect.value, until: overlay.querySelector("#recurrenceUntil").value, weekdays: [...overlay.querySelectorAll("#weekdayPicker input:checked")].map((input) => Number(input.value)) };
    const saved = editing ? updateActivity(id, payload, { recurrence, scope: overlay.querySelector("#editScope")?.value || "occurrence" }) : addActivity(payload, recurrence);
    selectedDate = saved.date; monthStart = firstOfMonth(saved.date); weekStart = startOfWeek(saved.date); closeModal(); render();
  });
}

function showReminder(force = false) {
  const current = today(); const now = new Date();
  if (!force && (now.getHours() < 10 || localStorage.getItem(`${DISMISS_KEY}${current}`) === "1")) return;
  const metrics = commandMetrics();
  if (!metrics.today.length && !metrics.followUps.length && !force) return;
  reminderShown = true;
  const focus = [...metrics.today].sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
  openModal(`<article class="modal briefing"><header class="modal-head"><div class="briefing-icon">☀</div><button class="close-button" data-dismiss-reminder>×</button></header><div class="eyebrow">10:00 AM morning briefing</div><h2>Good morning. Here’s the WAVE.</h2><p class="modal-description">${metrics.today.length} open today · ${metrics.followUps.length} follow-ups due · ${metrics.completed.length} completed</p><div class="briefing-focus"><span>Priority focus</span>${focus.length ? focus.slice(0, 5).map((activity) => `<button data-open-briefing="${activity.id}"><i class="priority-dot ${priorityClass(activity.priority)}"></i><span><strong>${escapeHtml(activity.title)}</strong><small>${escapeHtml(activity.owner)} · ${progress(activity)}%</small></span></button>`).join("") : '<p class="empty-copy">Nothing pending today.</p>'}</div>${metrics.followUps.length ? `<div class="briefing-callout"><strong>${metrics.followUps.length} follow-up${metrics.followUps.length === 1 ? "" : "s"} need attention</strong><span>Keep active conversations moving.</span></div>` : ""}<div class="reminder-actions"><button class="button" data-dismiss-reminder>Dismiss</button><button class="button primary" id="showToday">Open today</button></div></article>`);
  const dismiss = () => { localStorage.setItem(`${DISMISS_KEY}${current}`, "1"); closeModal(); };
  overlay.querySelectorAll("[data-dismiss-reminder]").forEach((button) => button.addEventListener("click", dismiss));
  overlay.querySelectorAll("[data-open-briefing]").forEach((button) => button.addEventListener("click", () => showActivityDetail(button.dataset.openBriefing)));
  overlay.querySelector("#showToday").addEventListener("click", () => { dismiss(); selectedDate = current; monthStart = firstOfMonth(); weekStart = startOfWeek(); render(); });
}

syncRecurrences();
carryForward();
save();
render();
showReminder();
setInterval(() => {
  carryForward();
  if (new Date().getHours() >= 10 && !reminderShown && localStorage.getItem(`${DISMISS_KEY}${today()}`) !== "1") { render(); showReminder(); }
}, 30_000);
