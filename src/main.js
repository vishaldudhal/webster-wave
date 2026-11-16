import "./styles.css";

const STORAGE_KEY = "growth30.planner.v1";
const DISMISS_KEY = "growth30.reminder.dismissed.";

const templates = {
  Marketing: ["Topic finalised", "Content drafted", "Creative ready", "Caption prepared", "Reviewed", "Published"],
  "Direct Outreach": ["Business researched", "Contact details collected", "Message prepared", "Message sent", "Follow-up completed"],
  "Local Business Development": ["Business shortlisted", "Research complete", "Contact established", "Visit or meeting completed", "Follow-up sent"],
  "Existing Network": ["Contacts selected", "Context reviewed", "Message prepared", "Message sent", "Follow-up completed"],
  "Past Client Development": ["Client selected", "Past work reviewed", "Opportunity identified", "Message sent", "Follow-up completed"],
  Inbound: ["Enquiry reviewed", "Response sent", "Requirements documented", "Next action set"],
  Partnerships: ["Partner researched", "Proposal prepared", "Outreach sent", "Conversation held", "Next steps recorded"],
  "Events & Networking": ["Event selected", "Registration completed", "Preparation completed", "Attended", "Contacts followed up"],
};

const pad = (value) => String(value).padStart(2, "0");
const toLocalDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDate = (value) => new Date(`${value}T12:00:00`);
const shiftDate = (value, amount) => {
  const date = parseDate(value);
  date.setDate(date.getDate() + amount);
  return toLocalDate(date);
};
const today = () => toLocalDate(new Date());
const niceDate = (value, options = {}) => parseDate(value).toLocaleDateString("en-IN", { day: "numeric", month: "long", ...options });
const weekDay = (value) => parseDate(value).toLocaleDateString("en-IN", { weekday: "long" });
const isWorkday = (value) => ![0, 6].includes(parseDate(value).getDay());
const nextWorkday = (value) => {
  let next = shiftDate(value, 1);
  while (!isWorkday(next)) next = shiftDate(next, 1);
  return next;
};
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const progress = (activity) => activity.items.length
  ? Math.round((activity.items.filter((item) => item.done).length / activity.items.length) * 100)
  : activity.manualDone ? 100 : 0;

function createExamples() {
  const base = today();
  const activity = (offset, title, vertical, completed = 0, fixed = false) => ({
    id: uid(),
    title,
    vertical,
    date: shiftDate(base, offset),
    originalDate: shiftDate(base, offset),
    fixed,
    manualDone: false,
    history: [],
    items: templates[vertical].map((label, index) => ({ label, done: index < completed })),
  });

  return [
    activity(0, "Plan this week’s LinkedIn insight", "Marketing", 2),
    activity(0, "Reach out to five potential clients", "Direct Outreach", 1),
    activity(1, "Reconnect with two former clients", "Past Client Development"),
    activity(3, "Review new business enquiries", "Inbound"),
    activity(5, "Explore an agency collaboration", "Partnerships"),
    activity(8, "Prepare for networking meetup", "Events & Networking", 0, true),
    activity(12, "Research local businesses", "Local Business Development"),
  ];
}

function readState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.activities)) return stored;
  } catch {
    // Invalid local data falls back to the starter plan.
  }
  return { activities: createExamples() };
}

let state = readState();
let periodStart = today();
let selectedDate = today();
let reminderShown = false;

const app = document.querySelector("#app");
const overlay = document.querySelector("#overlay");

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function carryForward() {
  const current = today();
  let changed = false;

  for (const activity of state.activities) {
    if (activity.fixed || activity.date >= current || progress(activity) === 100) continue;
    let destination = activity.date;
    while (destination < current) destination = nextWorkday(destination);
    if (destination !== activity.date) {
      activity.history ??= [];
      activity.history.push({ from: activity.date, to: destination });
      activity.date = destination;
      changed = true;
    }
  }

  if (changed) save();
}

function periodTitle() {
  const start = parseDate(periodStart);
  const end = parseDate(shiftDate(periodStart, 29));
  const startMonth = start.toLocaleDateString("en-IN", { month: "long" });
  const endMonth = end.toLocaleDateString("en-IN", { month: "long" });
  if (start.getFullYear() !== end.getFullYear()) return `${startMonth} ${start.getFullYear()} – ${endMonth} ${end.getFullYear()}`;
  if (start.getMonth() !== end.getMonth()) return `${startMonth} – ${endMonth} ${end.getFullYear()}`;
  return `${startMonth} ${start.getFullYear()}`;
}

function renderShell() {
  app.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div>
          <div class="eyebrow">Webster Actions · Visibility · Execution</div>
          <h1>Webster WAVE</h1>
          <p class="subtitle">One calendar. Every growth action. A little progress, every day.</p>
        </div>
        <div class="header-actions">
          <button class="button reminder-preview" id="previewReminder">◷ &nbsp; Preview reminder</button>
          <button class="button primary" id="addTop">＋ Add activity</button>
        </div>
      </header>

      <div class="workspace">
        <section class="panel" aria-label="30-day calendar">
          <div class="panel-inner">
            <div class="panel-header">
              <div>
                <h2 id="periodTitle"></h2>
                <div class="small" id="periodRange"></div>
              </div>
              <div class="period-actions">
                <label class="period-picker">
                  <input type="date" id="startDatePicker" aria-label="Choose planning period start date" />
                  <button class="button" id="chooseStart" type="button">⌗ <span>Start date</span></button>
                </label>
                <button class="button icon-button" id="previousPeriod" aria-label="Previous 30 days">‹</button>
                <button class="button icon-button" id="currentPeriod" aria-label="Return to today">•</button>
                <button class="button icon-button" id="nextPeriod" aria-label="Next 30 days">›</button>
              </div>
            </div>
            <div class="calendar-grid" id="calendar"></div>
            <div class="legend">
              <span><i class="dot todo"></i> To do</span>
              <span><i class="dot"></i> In progress</span>
              <span><i class="dot done"></i> Completed</span>
            </div>
            <p class="panel-note">Select a date to see its activities. Unfinished activities move to the next working day automatically.</p>
          </div>
        </section>

        <section class="panel" aria-label="Selected day activities">
          <div class="panel-inner">
            <div class="panel-header">
              <div>
                <div class="eyebrow" id="selectedWeekday"></div>
                <div class="date-heading" id="selectedDate"></div>
                <div class="small" id="activityCount"></div>
              </div>
              <button class="button" id="addDay">＋ Add</button>
            </div>
            <div class="activity-list" id="activityList"></div>
            <p class="panel-note">Open an activity to update its checklist and progress.</p>
          </div>
        </section>
      </div>
      <footer class="footer">A focused planner · Saved privately in this browser · No account required</footer>
    </div>`;

  document.querySelector("#addTop").addEventListener("click", () => showActivityForm());
  document.querySelector("#addDay").addEventListener("click", () => showActivityForm());
  document.querySelector("#previewReminder").addEventListener("click", () => showReminder(true));
  document.querySelector("#previousPeriod").addEventListener("click", () => changePeriod(-30));
  document.querySelector("#nextPeriod").addEventListener("click", () => changePeriod(30));
  document.querySelector("#currentPeriod").addEventListener("click", () => {
    periodStart = today();
    selectedDate = today();
    render();
  });

  const picker = document.querySelector("#startDatePicker");
  picker.value = periodStart;
  document.querySelector("#chooseStart").addEventListener("click", () => {
    if (typeof picker.showPicker === "function") picker.showPicker();
    else picker.click();
  });
  picker.addEventListener("change", () => {
    if (!picker.value) return;
    periodStart = picker.value;
    selectedDate = picker.value;
    render();
  });
}

function changePeriod(amount) {
  periodStart = shiftDate(periodStart, amount);
  selectedDate = periodStart;
  render();
}

function renderCalendar() {
  document.querySelector("#periodTitle").textContent = periodTitle();
  document.querySelector("#periodRange").textContent = `${niceDate(periodStart)} – ${niceDate(shiftDate(periodStart, 29), { year: "numeric" })}`;

  const first = parseDate(periodStart);
  const offset = (first.getDay() + 6) % 7;
  const weekdays = ["M", "T", "W", "T", "F", "S", "S"];
  const calendar = document.querySelector("#calendar");
  let html = weekdays.map((day) => `<div class="weekday">${day}</div>`).join("");
  html += Array.from({ length: offset }, () => '<div class="calendar-spacer" aria-hidden="true"></div>').join("");

  for (let index = 0; index < 30; index += 1) {
    const date = shiftDate(periodStart, index);
    const dateObject = parseDate(date);
    const activities = state.activities.filter((activity) => activity.date === date);
    const dots = activities.slice(0, 6).map((activity) => {
      const value = progress(activity);
      return `<i class="dot ${value === 100 ? "done" : value === 0 ? "todo" : ""}"></i>`;
    }).join("");
    const showMonth = index === 0 || dateObject.getDate() === 1;
    html += `
      <button class="day ${selectedDate === date ? "selected" : ""} ${today() === date ? "today" : ""}" data-date="${date}" aria-label="${niceDate(date, { year: "numeric" })}, ${activities.length} activities">
        <span class="day-number">${dateObject.getDate()}</span>
        ${showMonth ? `<span class="month-tag">${dateObject.toLocaleDateString("en-IN", { month: "short" })}</span>` : ""}
        <span class="day-dots">${dots}</span>
      </button>`;
  }

  calendar.innerHTML = html;
  calendar.querySelectorAll("[data-date]").forEach((button) => button.addEventListener("click", () => {
    selectedDate = button.dataset.date;
    render();
  }));
}

function renderActivities() {
  const activities = state.activities.filter((activity) => activity.date === selectedDate);
  document.querySelector("#selectedWeekday").textContent = weekDay(selectedDate);
  document.querySelector("#selectedDate").textContent = niceDate(selectedDate);
  document.querySelector("#activityCount").textContent = `${activities.length} ${activities.length === 1 ? "activity" : "activities"} planned`;

  const list = document.querySelector("#activityList");
  if (!activities.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">＋</div>Nothing planned for this day.<br />Add an activity when you’re ready.</div>`;
    return;
  }

  list.innerHTML = activities.map((activity) => {
    const value = progress(activity);
    const status = value === 100 ? "Complete" : value === 0 ? "To do" : "In progress";
    return `
      <button class="activity-card" data-activity="${activity.id}">
        <span class="activity-top">
          <strong class="activity-title">${escapeHtml(activity.title)}</strong>
          <span class="status-pill ${value === 100 ? "complete" : ""}">${status}</span>
        </span>
        <span class="activity-meta">${escapeHtml(activity.vertical)}${activity.history?.length ? " · ↪ Carried forward" : ""}</span>
        <span class="progress-row">
          <span class="progress-track"><span class="progress-fill" style="display:block;width:${value}%"></span></span>
          <span class="progress-value">${value}%</span>
        </span>
      </button>`;
  }).join("");

  list.querySelectorAll("[data-activity]").forEach((button) => button.addEventListener("click", () => showActivityDetail(button.dataset.activity)));
}

function render() {
  renderShell();
  renderCalendar();
  renderActivities();
}

function openModal(content) {
  overlay.innerHTML = content;
  overlay.classList.remove("hidden");
  overlay.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModal));
  overlay.addEventListener("click", closeOnBackdrop, { once: true });
  document.addEventListener("keydown", closeOnEscape);
}

function closeOnBackdrop(event) {
  if (event.target === overlay) closeModal();
}

function closeOnEscape(event) {
  if (event.key === "Escape") closeModal();
}

function closeModal() {
  overlay.classList.add("hidden");
  overlay.innerHTML = "";
  document.removeEventListener("keydown", closeOnEscape);
}

function showActivityDetail(id) {
  const activity = state.activities.find((item) => item.id === id);
  if (!activity) return;
  const value = progress(activity);
  const completed = activity.items.filter((item) => item.done).length;
  const originalNote = activity.history?.length ? ` · Originally ${niceDate(activity.originalDate)}` : "";
  const checklist = activity.items.length
    ? activity.items.map((item, index) => `
        <label class="check-row ${item.done ? "done" : ""}">
          <input type="checkbox" data-check="${index}" ${item.done ? "checked" : ""} />
          <span>${escapeHtml(item.label)}</span>
        </label>`).join("")
    : `<label class="check-row"><input type="checkbox" id="manualComplete" ${activity.manualDone ? "checked" : ""} /><span>Mark activity complete</span></label>`;

  openModal(`
    <article class="modal" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
      <header class="modal-head">
        <div>
          <div class="eyebrow">${escapeHtml(activity.vertical)}</div>
          <h2 id="detailTitle">${escapeHtml(activity.title)}</h2>
          <p class="modal-description">${niceDate(activity.date)}${originalNote}</p>
        </div>
        <button class="close-button" data-close aria-label="Close">×</button>
      </header>
      <div class="progress-row" style="margin-top:20px">
        <div class="progress-track"><div class="progress-fill" style="width:${value}%"></div></div>
        <strong>${value}%</strong>
      </div>
      <div class="section-label">Checklist · ${completed} of ${activity.items.length} complete</div>
      <div class="checklist">${checklist}</div>
      <div class="form-actions detail-actions">
        <button class="button ghost-danger" id="deleteActivity">Delete</button>
        <button class="button" id="editActivity">Edit</button>
        <button class="button primary" data-close>Done</button>
      </div>
    </article>`);

  overlay.querySelectorAll("[data-check]").forEach((checkbox) => checkbox.addEventListener("change", () => {
    activity.items[Number(checkbox.dataset.check)].done = checkbox.checked;
    save();
    render();
    showActivityDetail(id);
  }));
  const manual = overlay.querySelector("#manualComplete");
  if (manual) manual.addEventListener("change", () => {
    activity.manualDone = manual.checked;
    save();
    render();
    showActivityDetail(id);
  });
  overlay.querySelector("#editActivity").addEventListener("click", () => showActivityForm(id));
  overlay.querySelector("#deleteActivity").addEventListener("click", () => {
    if (!window.confirm("Delete this activity?")) return;
    state.activities = state.activities.filter((item) => item.id !== id);
    save();
    closeModal();
    render();
  });
}

function showActivityForm(id = null) {
  const activity = id ? state.activities.find((item) => item.id === id) : null;
  const editing = Boolean(activity);
  let draftItems = activity
    ? activity.items.map((item) => ({ ...item }))
    : templates.Marketing.map((label) => ({ label, done: false }));

  openModal(`
    <article class="modal" role="dialog" aria-modal="true" aria-labelledby="formTitle">
      <header class="modal-head">
        <div>
          <div class="eyebrow">${editing ? "Edit activity" : "New activity"}</div>
          <h2 id="formTitle">${editing ? "Update the plan" : "Add an activity"}</h2>
          <p class="modal-description">Choose a vertical and tailor the ready-made checklist.</p>
        </div>
        <button class="close-button" data-close aria-label="Close">×</button>
      </header>
      <form class="form" id="activityForm">
        <label class="field">Activity title
          <input id="activityTitle" required maxlength="120" placeholder="e.g. Publish a client case study" value="${escapeHtml(activity?.title ?? "")}" />
        </label>
        <label class="field">Business development vertical
          <select id="activityVertical">
            ${Object.keys(templates).map((vertical) => `<option ${activity?.vertical === vertical || (!activity && vertical === "Marketing") ? "selected" : ""}>${vertical}</option>`).join("")}
          </select>
        </label>
        <label class="field">Scheduled date
          <input id="activityDate" type="date" required value="${activity?.date ?? selectedDate}" />
        </label>
        <label class="inline-check">
          <input id="fixedDate" type="checkbox" ${activity?.fixed ? "checked" : ""} />
          Fixed-date event. Do not carry it forward automatically.
        </label>
        <div>
          <div class="section-label">Checklist steps</div>
          <div id="checklistEditor"></div>
          <button class="new-check" id="addChecklistItem" type="button">＋ Add checklist item</button>
        </div>
        <div class="form-actions">
          <button class="button" type="button" data-close>Cancel</button>
          <button class="button primary" type="submit">${editing ? "Save changes" : "Add activity"}</button>
        </div>
      </form>
    </article>`);

  const editor = overlay.querySelector("#checklistEditor");
  const verticalSelect = overlay.querySelector("#activityVertical");

  function drawChecklistEditor() {
    editor.innerHTML = draftItems.map((item, index) => `
      <div class="check-edit">
        <input data-check-input="${index}" aria-label="Checklist item ${index + 1}" value="${escapeHtml(item.label)}" />
        <button data-remove-check="${index}" type="button" aria-label="Remove checklist item">×</button>
      </div>`).join("");
    editor.querySelectorAll("[data-check-input]").forEach((input) => input.addEventListener("input", () => {
      draftItems[Number(input.dataset.checkInput)].label = input.value;
    }));
    editor.querySelectorAll("[data-remove-check]").forEach((button) => button.addEventListener("click", () => {
      draftItems.splice(Number(button.dataset.removeCheck), 1);
      drawChecklistEditor();
    }));
  }

  drawChecklistEditor();
  verticalSelect.addEventListener("change", () => {
    const shouldReplace = !editing || window.confirm("Replace the current checklist with this vertical’s template?");
    if (!shouldReplace) return;
    draftItems = templates[verticalSelect.value].map((label) => ({ label, done: false }));
    drawChecklistEditor();
  });
  overlay.querySelector("#addChecklistItem").addEventListener("click", () => {
    draftItems.push({ label: "", done: false });
    drawChecklistEditor();
    editor.querySelector(`[data-check-input="${draftItems.length - 1}"]`)?.focus();
  });
  overlay.querySelector("#activityForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = overlay.querySelector("#activityTitle").value.trim();
    const date = overlay.querySelector("#activityDate").value;
    if (!title || !date) return;
    const items = draftItems
      .filter((item) => item.label.trim())
      .map((item) => ({ ...item, label: item.label.trim() }));

    if (editing) {
      Object.assign(activity, {
        title,
        vertical: verticalSelect.value,
        date,
        fixed: overlay.querySelector("#fixedDate").checked,
        items,
      });
    } else {
      state.activities.push({
        id: uid(), title, vertical: verticalSelect.value, date, originalDate: date, fixed: overlay.querySelector("#fixedDate").checked,
        manualDone: false, history: [], items,
      });
    }

    selectedDate = date;
    if (date < periodStart || date > shiftDate(periodStart, 29)) periodStart = date;
    save();
    closeModal();
    render();
  });
}

function showReminder(force = false) {
  const current = today();
  const now = new Date();
  if (!force && (now.getHours() < 10 || localStorage.getItem(`${DISMISS_KEY}${current}`) === "1")) return;
  const pending = state.activities.filter((activity) => activity.date === current && progress(activity) < 100);
  if (!pending.length && !force) return;
  reminderShown = true;

  openModal(`
    <article class="modal reminder" role="dialog" aria-modal="true" aria-labelledby="reminderTitle">
      <header class="modal-head">
        <div class="reminder-icon">◷</div>
        <button class="close-button" data-dismiss-reminder aria-label="Dismiss">×</button>
      </header>
      <div class="eyebrow">Daily reminder · 10:00 AM</div>
      <h2 id="reminderTitle">${pending.length ? `${pending.length} ${pending.length === 1 ? "activity" : "activities"} today` : "Nothing pending today"}</h2>
      <p class="modal-description">${pending.length ? `Here’s what is on your list for ${niceDate(current)}.` : "You’re all caught up."}</p>
      <ul class="reminder-list">
        ${pending.slice(0, 5).map((activity) => `<li><span>${escapeHtml(activity.title)}</span><span>${progress(activity)}%</span></li>`).join("")}
      </ul>
      <p class="modal-description">This reminder appears when the planner is open at or after 10 AM.</p>
      <div class="reminder-actions" style="margin-top:18px">
        <button class="button" data-dismiss-reminder>Dismiss</button>
        <button class="button primary" id="showToday">See today’s plan</button>
      </div>
    </article>`);

  const dismiss = () => {
    localStorage.setItem(`${DISMISS_KEY}${current}`, "1");
    closeModal();
  };
  overlay.querySelectorAll("[data-dismiss-reminder]").forEach((button) => button.addEventListener("click", dismiss));
  overlay.querySelector("#showToday").addEventListener("click", () => {
    dismiss();
    periodStart = current;
    selectedDate = current;
    render();
  });
}

carryForward();
save();
render();
showReminder();

setInterval(() => {
  carryForward();
  if (new Date().getHours() >= 10 && !reminderShown && localStorage.getItem(`${DISMISS_KEY}${today()}`) !== "1") {
    render();
    showReminder();
  }
}, 30_000);
