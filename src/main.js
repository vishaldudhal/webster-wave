import "./styles.css";

const STORAGE_KEY = "growth30.planner.v1";
const DISMISS_KEY = "growth30.reminder.dismissed.";
const DEFAULT_OWNER = "Vishal";
const priorities = ["High", "Medium", "Low"];
const templates = {
  Marketing: ["Define objective and audience", "Draft content", "Prepare creative", "Review and approve", "Publish", "Record results"],
  "Direct Outreach": ["Research the business", "Identify the right contact", "Personalise the message", "Send outreach", "Schedule follow-up", "Record outcome"],
  "Local Business Development": ["Shortlist the business", "Complete research", "Establish contact", "Complete visit or meeting", "Send follow-up", "Record next step"],
  "Existing Network": ["Select the contact", "Review context", "Prepare a relevant message", "Send message", "Complete follow-up", "Record outcome"],
  "Past Client Development": ["Review past work", "Identify a relevant opportunity", "Prepare the approach", "Send message", "Complete follow-up", "Record outcome"],
  Inbound: ["Review enquiry", "Send initial response", "Document requirements", "Qualify opportunity", "Set next action"],
  Partnerships: ["Research partner fit", "Define mutual value", "Prepare proposal", "Start conversation", "Agree next steps", "Record outcome"],
  "Events & Networking": ["Select event", "Register", "Set networking goals", "Prepare talking points", "Attend", "Follow up with contacts"],
};

const pad = (value) => String(value).padStart(2, "0");
const toLocalDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDate = (value) => new Date(`${value}T12:00:00`);
const shiftDate = (value, amount) => { const date = parseDate(value); date.setDate(date.getDate() + amount); return toLocalDate(date); };
const today = () => toLocalDate(new Date());
const niceDate = (value, options = {}) => value ? parseDate(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...options }) : "Not set";
const weekDay = (value) => parseDate(value).toLocaleDateString("en-IN", { weekday: "long" });
const isWorkday = (value) => ![0, 6].includes(parseDate(value).getDay());
const nextWorkday = (value) => { let next = shiftDate(value, 1); while (!isWorkday(next)) next = shiftDate(next, 1); return next; };
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const progress = (activity) => activity.items.length ? Math.round((activity.items.filter((item) => item.done).length / activity.items.length) * 100) : activity.manualDone ? 100 : 0;
const statusOf = (activity) => progress(activity) === 100 ? "Completed" : progress(activity) ? "In progress" : "Scheduled";
const priorityClass = (priority) => String(priority || "Medium").toLowerCase();
const isFollowUpDue = (activity) => activity.followUpDate && activity.followUpDate <= today() && !activity.followUpDone;

function normalizeActivity(activity) {
  const items = Array.isArray(activity.items) ? activity.items.map((item) => ({ id: item.id || uid(), label: String(item.label || "Checklist item"), done: Boolean(item.done) })) : [];
  return { ...activity, id: activity.id || uid(), title: String(activity.title || "Untitled activity"), vertical: templates[activity.vertical] ? activity.vertical : "Marketing", date: activity.date || today(), originalDate: activity.originalDate || activity.date || today(), fixed: Boolean(activity.fixed), manualDone: Boolean(activity.manualDone), history: Array.isArray(activity.history) ? activity.history : [], items, owner: String(activity.owner || DEFAULT_OWNER), priority: priorities.includes(activity.priority) ? activity.priority : "Medium", notes: String(activity.notes || ""), resources: String(activity.resources || ""), followUpDate: activity.followUpDate || "", followUpDone: Boolean(activity.followUpDone), createdAt: activity.createdAt || new Date().toISOString(), updatedAt: activity.updatedAt || new Date().toISOString() };
}

function createExamples() {
  const base = today();
  const activity = (offset, title, vertical, completed = 0, fixed = false, priority = "Medium", followUpOffset = "") => normalizeActivity({ id: uid(), title, vertical, date: shiftDate(base, offset), originalDate: shiftDate(base, offset), fixed, priority, owner: DEFAULT_OWNER, followUpDate: followUpOffset === "" ? "" : shiftDate(base, followUpOffset), items: templates[vertical].map((label, index) => ({ id: uid(), label, done: index < completed })) });
  return [activity(0, "Plan this week’s LinkedIn insight", "Marketing", 2), activity(0, "Reach out to five potential clients", "Direct Outreach", 1, false, "High", 2), activity(1, "Reconnect with two former clients", "Past Client Development", 0, false, "High", 4), activity(3, "Review new business enquiries", "Inbound", 0, false, "High"), activity(5, "Explore an agency collaboration", "Partnerships", 0, false, "Medium", 8), activity(8, "Prepare for networking meetup", "Events & Networking", 0, true), activity(12, "Research local businesses", "Local Business Development", 0, false, "Low")];
}

function readState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.activities)) return { ...stored, schemaVersion: 2, activities: stored.activities.map(normalizeActivity), team: Array.from(new Set([DEFAULT_OWNER, ...(stored.team || []), ...stored.activities.map((item) => item.owner).filter(Boolean)])) };
  } catch { /* Invalid local data falls back to starter content. */ }
  return { schemaVersion: 2, activities: createExamples(), team: [DEFAULT_OWNER] };
}

let state = readState();
let periodStart = today();
let selectedDate = today();
let ownerFilter = "All";
let reminderShown = false;
const app = document.querySelector("#app");
const overlay = document.querySelector("#overlay");

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function visibleActivities() { return ownerFilter === "All" ? state.activities : state.activities.filter((activity) => activity.owner === ownerFilter); }
function carryForward() {
  const current = today(); let changed = false;
  for (const activity of state.activities) {
    if (activity.fixed || activity.date >= current || progress(activity) === 100) continue;
    let destination = activity.date; while (destination < current) destination = nextWorkday(destination);
    if (destination !== activity.date) { activity.history.push({ type: "carried", from: activity.date, to: destination, at: new Date().toISOString() }); activity.date = destination; activity.updatedAt = new Date().toISOString(); changed = true; }
  }
  if (changed) save();
}
function periodTitle() {
  const start = parseDate(periodStart); const end = parseDate(shiftDate(periodStart, 29)); const startMonth = start.toLocaleDateString("en-IN", { month: "long" }); const endMonth = end.toLocaleDateString("en-IN", { month: "long" });
  if (start.getFullYear() !== end.getFullYear()) return `${startMonth} ${start.getFullYear()} – ${endMonth} ${end.getFullYear()}`;
  if (start.getMonth() !== end.getMonth()) return `${startMonth} – ${endMonth} ${end.getFullYear()}`;
  return `${startMonth} ${start.getFullYear()}`;
}
function commandMetrics() {
  const activities = visibleActivities(); const current = today();
  return { today: activities.filter((activity) => activity.date === current && progress(activity) < 100), pending: activities.filter((activity) => activity.date <= current && progress(activity) < 100), followUps: activities.filter(isFollowUpDue), completed: activities.filter((activity) => activity.date === current && progress(activity) === 100) };
}

function renderShell() {
  const owners = ["All", ...state.team];
  app.innerHTML = `<div class="app-shell">
    <header class="app-header"><div class="brand-lockup"><div class="brand-mark">W</div><div><div class="eyebrow">Business Development Command Centre</div><h1>Webster WAVE</h1><p class="subtitle">Actions, visibility and execution. One focused calendar.</p></div></div><div class="header-actions"><label class="owner-filter"><span>Owner</span><select id="ownerFilter">${owners.map((owner) => `<option ${ownerFilter === owner ? "selected" : ""}>${escapeHtml(owner)}</option>`).join("")}</select></label><button class="button reminder-preview" id="previewReminder">☀ Morning briefing</button><button class="button primary" id="addTop">＋ Add activity</button></div></header>
    <section class="command-strip" id="commandStrip" aria-label="Daily command centre"></section>
    <div class="workspace">
      <section class="panel calendar-panel" aria-label="30-day calendar"><div class="panel-inner"><div class="panel-header"><div><div class="section-kicker">30-day execution window</div><h2 id="periodTitle"></h2><div class="small" id="periodRange"></div></div><div class="period-actions"><label class="period-picker"><input type="date" id="startDatePicker" aria-label="Choose planning period start date" /><button class="button" id="chooseStart" type="button">⌗ <span>Start</span></button></label><button class="button icon-button" id="previousPeriod" aria-label="Previous 30 days">‹</button><button class="button today-button" id="currentPeriod">Today</button><button class="button icon-button" id="nextPeriod" aria-label="Next 30 days">›</button></div></div><div class="calendar-grid" id="calendar"></div><div class="legend"><span><i class="legend-mark scheduled"></i> Scheduled</span><span><i class="legend-mark progress"></i> In progress</span><span><i class="legend-mark completed"></i> Completed</span><span><i class="legend-mark carried"></i> Carried forward</span></div></div></section>
      <section class="panel day-panel" aria-label="Selected day activities"><div class="panel-inner"><div class="panel-header day-header"><div><div class="eyebrow" id="selectedWeekday"></div><div class="date-heading" id="selectedDate"></div><div class="small" id="activityCount"></div></div><button class="button compact" id="addDay">＋ Add</button></div><div class="day-progress" id="dayProgress"></div><div class="activity-list" id="activityList"></div></div></section>
    </div><footer class="footer"><span>WAVE keeps data privately in this browser</span><span>Automatic working-day carry-forward enabled</span></footer></div>`;
  document.querySelector("#addTop").addEventListener("click", () => showActivityForm());
  document.querySelector("#addDay").addEventListener("click", () => showActivityForm());
  document.querySelector("#previewReminder").addEventListener("click", () => showReminder(true));
  document.querySelector("#ownerFilter").addEventListener("change", (event) => { ownerFilter = event.target.value; render(); });
  document.querySelector("#previousPeriod").addEventListener("click", () => changePeriod(-30));
  document.querySelector("#nextPeriod").addEventListener("click", () => changePeriod(30));
  document.querySelector("#currentPeriod").addEventListener("click", () => { periodStart = today(); selectedDate = today(); render(); });
  const picker = document.querySelector("#startDatePicker"); picker.value = periodStart;
  document.querySelector("#chooseStart").addEventListener("click", () => typeof picker.showPicker === "function" ? picker.showPicker() : picker.click());
  picker.addEventListener("change", () => { if (picker.value) { periodStart = picker.value; selectedDate = picker.value; render(); } });
}

function renderCommandStrip() {
  const metrics = commandMetrics();
  const cards = [["today", "Today", metrics.today.length, "Activities to move forward"], ["pending", "Pending", metrics.pending.length, "Open through today"], ["followups", "Follow-ups", metrics.followUps.length, "Due for attention"], ["completed", "Completed", metrics.completed.length, "Finished today"]];
  document.querySelector("#commandStrip").innerHTML = `<div class="command-intro"><span class="pulse"></span><div><strong>${weekDay(today())}, ${niceDate(today())}</strong><small>${ownerFilter === "All" ? "All owners" : escapeHtml(ownerFilter)} · Live execution overview</small></div></div><div class="metric-grid">${cards.map(([key, label, count, help]) => `<button class="metric-card ${key}" data-metric="${key}"><span class="metric-label">${label}</span><strong>${count}</strong><small>${help}</small></button>`).join("")}</div>`;
  document.querySelectorAll("[data-metric]").forEach((button) => button.addEventListener("click", () => { selectedDate = today(); if (selectedDate < periodStart || selectedDate > shiftDate(periodStart, 29)) periodStart = selectedDate; render(); }));
}
function changePeriod(amount) { periodStart = shiftDate(periodStart, amount); selectedDate = periodStart; render(); }

function renderCalendar() {
  document.querySelector("#periodTitle").textContent = periodTitle();
  document.querySelector("#periodRange").textContent = `${niceDate(periodStart)} – ${niceDate(shiftDate(periodStart, 29), { year: "numeric" })}`;
  const first = parseDate(periodStart); const offset = (first.getDay() + 6) % 7; const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; const activities = visibleActivities(); const calendar = document.querySelector("#calendar");
  let html = weekdays.map((day) => `<div class="weekday">${day}</div>`).join("") + Array.from({ length: offset }, () => '<div class="calendar-spacer" aria-hidden="true"></div>').join("");
  for (let index = 0; index < 30; index += 1) {
    const date = shiftDate(periodStart, index); const dateObject = parseDate(date); const dayItems = activities.filter((activity) => activity.date === date); const completed = dayItems.filter((activity) => progress(activity) === 100).length; const average = dayItems.length ? Math.round(dayItems.reduce((sum, activity) => sum + progress(activity), 0) / dayItems.length) : 0; const highest = dayItems.some((activity) => activity.priority === "High" && progress(activity) < 100); const carried = dayItems.some((activity) => activity.history.some((event) => event.type === "carried" || event.from)); const showMonth = index === 0 || dateObject.getDate() === 1;
    html += `<button class="day ${selectedDate === date ? "selected" : ""} ${today() === date ? "today" : ""} ${carried ? "has-carried" : ""}" data-date="${date}" aria-label="${niceDate(date, { year: "numeric" })}, ${dayItems.length} activities"><span class="day-top"><span class="day-number">${dateObject.getDate()}</span>${showMonth ? `<span class="month-tag">${dateObject.toLocaleDateString("en-IN", { month: "short" })}</span>` : ""}${highest ? '<i class="priority-pin" title="High priority work"></i>' : ""}</span>${dayItems.length ? `<span class="day-count"><b>${dayItems.length}</b> ${dayItems.length === 1 ? "activity" : "activities"}</span><span class="mini-progress"><i style="width:${average}%"></i></span><span class="day-summary">${completed}/${dayItems.length} done · ${average}%</span>` : '<span class="day-empty">Open</span>'}</button>`;
  }
  calendar.innerHTML = html;
  calendar.querySelectorAll("[data-date]").forEach((button) => button.addEventListener("click", () => { selectedDate = button.dataset.date; render(); }));
}

function renderActivities() {
  const activities = visibleActivities().filter((activity) => activity.date === selectedDate).sort((a, b) => priorities.indexOf(a.priority) - priorities.indexOf(b.priority));
  document.querySelector("#selectedWeekday").textContent = selectedDate === today() ? "Today" : weekDay(selectedDate);
  document.querySelector("#selectedDate").textContent = niceDate(selectedDate, { year: "numeric" });
  document.querySelector("#activityCount").textContent = `${activities.length} ${activities.length === 1 ? "activity" : "activities"} · ${ownerFilter === "All" ? "all owners" : ownerFilter}`;
  const average = activities.length ? Math.round(activities.reduce((sum, activity) => sum + progress(activity), 0) / activities.length) : 0;
  document.querySelector("#dayProgress").innerHTML = activities.length ? `<div><span>Day progress</span><strong>${average}%</strong></div><div class="progress-track"><i class="progress-fill" style="width:${average}%"></i></div>` : "";
  const list = document.querySelector("#activityList");
  if (!activities.length) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">＋</div><strong>Clear runway</strong><span>Nothing planned for this day.</span><button class="text-button" id="emptyAdd">Add an activity</button></div>`; document.querySelector("#emptyAdd").addEventListener("click", () => showActivityForm()); return; }
  list.innerHTML = activities.map((activity) => { const value = progress(activity); const carried = activity.history.some((event) => event.type === "carried" || event.from); return `<button class="activity-card ${value === 100 ? "is-complete" : ""}" data-activity="${activity.id}"><span class="activity-accent ${priorityClass(activity.priority)}"></span><span class="activity-content"><span class="activity-top"><strong class="activity-title">${escapeHtml(activity.title)}</strong><span class="status-pill ${statusOf(activity).toLowerCase().replace(" ", "-")}">${statusOf(activity)}</span></span><span class="activity-meta"><span>${escapeHtml(activity.vertical)}</span><span class="owner-avatar">${escapeHtml(activity.owner.charAt(0).toUpperCase())}</span><span>${escapeHtml(activity.owner)}</span>${carried ? '<span class="carried-tag">↗ Carried</span>' : ""}${isFollowUpDue(activity) ? '<span class="followup-tag">Follow-up due</span>' : ""}</span><span class="progress-row"><span class="progress-track"><i class="progress-fill" style="width:${value}%"></i></span><span class="progress-value">${value}%</span><span class="card-arrow">›</span></span></span></button>`; }).join("");
  list.querySelectorAll("[data-activity]").forEach((button) => button.addEventListener("click", () => showActivityDetail(button.dataset.activity)));
}
function render() { renderShell(); renderCommandStrip(); renderCalendar(); renderActivities(); }

function openModal(content, drawer = false) { overlay.innerHTML = content; overlay.className = `overlay ${drawer ? "drawer-overlay" : ""}`; overlay.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModal)); overlay.addEventListener("click", closeOnBackdrop, { once: true }); document.addEventListener("keydown", closeOnEscape); }
function closeOnBackdrop(event) { if (event.target === overlay) closeModal(); }
function closeOnEscape(event) { if (event.key === "Escape") closeModal(); }
function closeModal() { overlay.className = "overlay hidden"; overlay.innerHTML = ""; document.removeEventListener("keydown", closeOnEscape); }
function resourceLinks(value) { const lines = String(value || "").split("\n").map((line) => line.trim()).filter(Boolean); if (!lines.length) return '<p class="empty-copy">No resources added yet.</p>'; return `<div class="resource-list">${lines.map((line) => /^https?:\/\//i.test(line) ? `<a href="${escapeHtml(line)}" target="_blank" rel="noopener">↗ ${escapeHtml(line.replace(/^https?:\/\//, ""))}</a>` : `<span>• ${escapeHtml(line)}</span>`).join("")}</div>`; }

function showActivityDetail(id) {
  const activity = state.activities.find((item) => item.id === id); if (!activity) return;
  const value = progress(activity); const completed = activity.items.filter((item) => item.done).length; const carried = activity.history.filter((event) => event.type === "carried" || event.from);
  const checklist = activity.items.length ? activity.items.map((item, index) => `<label class="check-row ${item.done ? "done" : ""}"><input type="checkbox" data-check="${index}" ${item.done ? "checked" : ""} /><span>${escapeHtml(item.label)}</span></label>`).join("") : `<label class="check-row"><input type="checkbox" id="manualComplete" ${activity.manualDone ? "checked" : ""} /><span>Mark activity complete</span></label>`;
  openModal(`<aside class="activity-drawer" role="dialog" aria-modal="true" aria-labelledby="detailTitle"><header class="drawer-head"><div><div class="eyebrow">${escapeHtml(activity.vertical)}</div><h2 id="detailTitle">${escapeHtml(activity.title)}</h2></div><button class="close-button" data-close aria-label="Close">×</button></header><div class="drawer-badges"><span class="priority-badge ${priorityClass(activity.priority)}">${escapeHtml(activity.priority)} priority</span><span class="status-pill ${statusOf(activity).toLowerCase().replace(" ", "-")}">${statusOf(activity)}</span>${carried.length ? '<span class="carried-tag">↗ Carried forward</span>' : ""}</div><div class="detail-grid"><div><span>Scheduled</span><strong>${niceDate(activity.date, { year: "numeric" })}</strong></div><div><span>Owner</span><strong>${escapeHtml(activity.owner)}</strong></div><div><span>Follow-up</span><strong>${activity.followUpDate ? niceDate(activity.followUpDate, { year: "numeric" }) : "Not set"}</strong></div><div><span>Original date</span><strong>${niceDate(activity.originalDate, { year: "numeric" })}</strong></div></div><section class="progress-hero"><div><span>Overall progress</span><strong>${value}%</strong></div><div class="progress-track"><i class="progress-fill" style="width:${value}%"></i></div><small>${completed} of ${activity.items.length || 1} steps complete</small></section><section class="drawer-section"><div class="section-title"><h3>Execution checklist</h3><span>${completed}/${activity.items.length}</span></div><div class="checklist">${checklist}</div></section><section class="drawer-section"><div class="section-title"><h3>Notes</h3></div>${activity.notes ? `<p class="notes-copy">${escapeHtml(activity.notes).replace(/\n/g, "<br>")}</p>` : '<p class="empty-copy">No notes added yet.</p>'}</section><section class="drawer-section"><div class="section-title"><h3>Resources</h3></div>${resourceLinks(activity.resources)}</section>${activity.followUpDate ? `<label class="followup-check ${activity.followUpDone ? "done" : ""}"><input type="checkbox" id="followUpDone" ${activity.followUpDone ? "checked" : ""}/><span><strong>Follow-up ${activity.followUpDone ? "completed" : "tracked"}</strong><small>${niceDate(activity.followUpDate, { year: "numeric" })}</small></span></label>` : ""}${carried.length ? `<section class="drawer-section activity-history"><div class="section-title"><h3>Activity history</h3></div>${carried.slice(-3).reverse().map((event) => `<p>Carried from ${niceDate(event.from)} to ${niceDate(event.to)}</p>`).join("")}</section>` : ""}<div class="drawer-actions"><button class="button ghost-danger" id="deleteActivity">Delete</button><button class="button" id="editActivity">Edit activity</button><button class="button primary" data-close>Done</button></div></aside>`, true);
  overlay.querySelectorAll("[data-check]").forEach((checkbox) => checkbox.addEventListener("change", () => { activity.items[Number(checkbox.dataset.check)].done = checkbox.checked; activity.updatedAt = new Date().toISOString(); save(); render(); showActivityDetail(id); }));
  const manual = overlay.querySelector("#manualComplete"); if (manual) manual.addEventListener("change", () => { activity.manualDone = manual.checked; save(); render(); showActivityDetail(id); });
  const followUpDone = overlay.querySelector("#followUpDone"); if (followUpDone) followUpDone.addEventListener("change", () => { activity.followUpDone = followUpDone.checked; save(); render(); showActivityDetail(id); });
  overlay.querySelector("#editActivity").addEventListener("click", () => showActivityForm(id));
  overlay.querySelector("#deleteActivity").addEventListener("click", () => { if (!window.confirm("Delete this activity?")) return; state.activities = state.activities.filter((item) => item.id !== id); save(); closeModal(); render(); });
}

function showActivityForm(id = null) {
  const activity = id ? state.activities.find((item) => item.id === id) : null; const editing = Boolean(activity);
  let draftItems = activity ? activity.items.map((item) => ({ ...item })) : templates.Marketing.map((label) => ({ id: uid(), label, done: false }));
  openModal(`<article class="modal form-modal" role="dialog" aria-modal="true" aria-labelledby="formTitle"><header class="modal-head"><div><div class="eyebrow">${editing ? "Edit activity" : "New activity"}</div><h2 id="formTitle">${editing ? "Update the activity" : "Plan the next action"}</h2><p class="modal-description">Set clear ownership, priority and next steps.</p></div><button class="close-button" data-close aria-label="Close">×</button></header><form class="form" id="activityForm"><label class="field span-2">Activity title<input id="activityTitle" required maxlength="120" placeholder="What needs to happen?" value="${escapeHtml(activity?.title ?? "")}" /></label><label class="field">Vertical<select id="activityVertical">${Object.keys(templates).map((vertical) => `<option ${activity?.vertical === vertical || (!activity && vertical === "Marketing") ? "selected" : ""}>${vertical}</option>`).join("")}</select></label><label class="field">Owner<input id="activityOwner" list="ownerOptions" required maxlength="50" placeholder="Team member" value="${escapeHtml(activity?.owner ?? DEFAULT_OWNER)}"/><datalist id="ownerOptions">${state.team.map((owner) => `<option value="${escapeHtml(owner)}">`).join("")}</datalist></label><label class="field">Scheduled date<input id="activityDate" type="date" required value="${activity?.date ?? selectedDate}" /></label><label class="field">Priority<select id="activityPriority">${priorities.map((priority) => `<option ${activity?.priority === priority || (!activity && priority === "Medium") ? "selected" : ""}>${priority}</option>`).join("")}</select></label><label class="field">Follow-up date<input id="followUpDate" type="date" value="${activity?.followUpDate ?? ""}" /></label><label class="inline-check fixed-field"><input id="fixedDate" type="checkbox" ${activity?.fixed ? "checked" : ""} /><span><strong>Fixed date</strong><small>Never carry this activity forward</small></span></label><label class="field span-2">Notes<textarea id="activityNotes" rows="3" placeholder="Context, talking points or desired outcome">${escapeHtml(activity?.notes ?? "")}</textarea></label><label class="field span-2">Resources<textarea id="activityResources" rows="2" placeholder="Add links or references, one per line">${escapeHtml(activity?.resources ?? "")}</textarea></label><div class="span-2"><div class="section-title checklist-heading"><h3>Checklist template</h3><span id="stepCount"></span></div><div id="checklistEditor"></div><button class="new-check" id="addChecklistItem" type="button">＋ Add checklist step</button></div><div class="form-actions span-2"><button class="button" type="button" data-close>Cancel</button><button class="button primary" type="submit">${editing ? "Save changes" : "Add activity"}</button></div></form></article>`);
  const editor = overlay.querySelector("#checklistEditor"); const verticalSelect = overlay.querySelector("#activityVertical");
  function drawChecklistEditor() { overlay.querySelector("#stepCount").textContent = `${draftItems.length} steps`; editor.innerHTML = draftItems.map((item, index) => `<div class="check-edit"><span>${index + 1}</span><input data-check-input="${index}" aria-label="Checklist item ${index + 1}" value="${escapeHtml(item.label)}" /><button data-remove-check="${index}" type="button" aria-label="Remove checklist item">×</button></div>`).join(""); editor.querySelectorAll("[data-check-input]").forEach((input) => input.addEventListener("input", () => { draftItems[Number(input.dataset.checkInput)].label = input.value; })); editor.querySelectorAll("[data-remove-check]").forEach((button) => button.addEventListener("click", () => { draftItems.splice(Number(button.dataset.removeCheck), 1); drawChecklistEditor(); })); }
  drawChecklistEditor();
  verticalSelect.addEventListener("change", () => { if (editing && !window.confirm("Replace the current checklist with this vertical’s template?")) return; draftItems = templates[verticalSelect.value].map((label) => ({ id: uid(), label, done: false })); drawChecklistEditor(); });
  overlay.querySelector("#addChecklistItem").addEventListener("click", () => { draftItems.push({ id: uid(), label: "", done: false }); drawChecklistEditor(); editor.querySelector(`[data-check-input="${draftItems.length - 1}"]`)?.focus(); });
  overlay.querySelector("#activityForm").addEventListener("submit", (event) => { event.preventDefault(); const title = overlay.querySelector("#activityTitle").value.trim(); const date = overlay.querySelector("#activityDate").value; const owner = overlay.querySelector("#activityOwner").value.trim() || DEFAULT_OWNER; if (!title || !date) return; const items = draftItems.filter((item) => item.label.trim()).map((item) => ({ ...item, id: item.id || uid(), label: item.label.trim() })); const payload = { title, vertical: verticalSelect.value, owner, date, priority: overlay.querySelector("#activityPriority").value, followUpDate: overlay.querySelector("#followUpDate").value, fixed: overlay.querySelector("#fixedDate").checked, notes: overlay.querySelector("#activityNotes").value.trim(), resources: overlay.querySelector("#activityResources").value.trim(), items, updatedAt: new Date().toISOString() }; if (editing) Object.assign(activity, payload); else state.activities.push(normalizeActivity({ id: uid(), originalDate: date, history: [], ...payload })); if (!state.team.includes(owner)) state.team.push(owner); selectedDate = date; if (date < periodStart || date > shiftDate(periodStart, 29)) periodStart = date; save(); closeModal(); render(); });
}

function showReminder(force = false) {
  const current = today(); const now = new Date(); if (!force && (now.getHours() < 10 || localStorage.getItem(`${DISMISS_KEY}${current}`) === "1")) return;
  const metrics = commandMetrics(); if (!metrics.today.length && !metrics.followUps.length && !force) return; reminderShown = true; const priorityWork = [...metrics.today].sort((a, b) => priorities.indexOf(a.priority) - priorities.indexOf(b.priority));
  openModal(`<article class="modal briefing" role="dialog" aria-modal="true" aria-labelledby="reminderTitle"><header class="modal-head"><div class="briefing-icon">☀</div><button class="close-button" data-dismiss-reminder aria-label="Dismiss">×</button></header><div class="eyebrow">10:00 AM morning briefing</div><h2 id="reminderTitle">Good morning. Here’s the WAVE.</h2><p class="modal-description">${metrics.today.length} open today · ${metrics.followUps.length} follow-ups due · ${metrics.completed.length} completed</p><div class="briefing-focus"><span>Priority focus</span>${priorityWork.length ? priorityWork.slice(0, 4).map((activity) => `<button data-open-briefing="${activity.id}"><i class="priority-dot ${priorityClass(activity.priority)}"></i><span><strong>${escapeHtml(activity.title)}</strong><small>${escapeHtml(activity.owner)} · ${progress(activity)}%</small></span></button>`).join("") : '<p class="empty-copy">Nothing pending today.</p>'}</div>${metrics.followUps.length ? `<div class="briefing-callout"><strong>${metrics.followUps.length} follow-up${metrics.followUps.length === 1 ? "" : "s"} need attention</strong><span>Keep conversations moving while they’re warm.</span></div>` : ""}<div class="reminder-actions"><button class="button" data-dismiss-reminder>Dismiss</button><button class="button primary" id="showToday">Open today’s plan</button></div></article>`);
  const dismiss = () => { localStorage.setItem(`${DISMISS_KEY}${current}`, "1"); closeModal(); };
  overlay.querySelectorAll("[data-dismiss-reminder]").forEach((button) => button.addEventListener("click", dismiss));
  overlay.querySelectorAll("[data-open-briefing]").forEach((button) => button.addEventListener("click", () => showActivityDetail(button.dataset.openBriefing)));
  overlay.querySelector("#showToday").addEventListener("click", () => { dismiss(); periodStart = current; selectedDate = current; render(); });
}

carryForward(); save(); render(); showReminder();
setInterval(() => { carryForward(); if (new Date().getHours() >= 10 && !reminderShown && localStorage.getItem(`${DISMISS_KEY}${today()}`) !== "1") { render(); showReminder(); } }, 30_000);
