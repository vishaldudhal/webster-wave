import "./styles.css";
import { ACTIVITY_TYPE_SUGGESTIONS, BLOG_TYPES, CATEGORY_SUGGESTIONS, DEFAULT_OWNER, DISMISS_KEY, MARKETING_CHANNELS, PLATFORM_SUGGESTIONS, PRIORITIES, PUBLISHING_STATUSES, SESSION_KEY, STATUSES, UI_KEY, VERTICAL_TEMPLATES } from "./config.js";
import { daysInMonth, endOfWeek, firstOfMonth, lastOfMonth, monthTitle, niceDate, parseDate, shiftDate, shiftMonth, startOfWeek, today, weekDay } from "./dates.js";
import { addActivity, carryForward, createBackup, deleteActivity, getSchedule, isFollowUpDue, loadDemoData, progress, restoreBackup, save, state, statusOf, syncRecurrences, uid, updateActivity } from "./store.js";

let activeModule = "overview";
let viewMode = "week";
let monthStart = firstOfMonth();
let weekStart = startOfWeek();
let selectedDate = today();
let plannerFilter = "All";
let activitySearch = "";
let ownerFilter = "All";
let verticalFilter = "All";
let statusFilter = "All";
let reminderShown = false;
let sidebarCollapsed = JSON.parse(localStorage.getItem(UI_KEY) || "{}").sidebarCollapsed || false;

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
  const activities = state.activities;
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
  if (localStorage.getItem(SESSION_KEY) !== "active") { renderLogin(); return; }
  ensureVisibleRecurrences();
  const notifications = notificationItems();
  const moduleTitles = { overview: ["Overview", `Welcome back, ${state.profile.name.split(" ")[0] || "there"}. Here’s today’s WAVE.`], planner: ["Planner", "Plan once. Execute everywhere."], activities: ["Activities", "Every business development and marketing action in one place."], settings: ["Settings", "Configure your workspace, team and planning rules."] };
  const [title, description] = moduleTitles[activeModule];
  app.innerHTML = `<div class="saas-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}">
    <aside class="sidebar" id="sidebar"><div class="sidebar-brand"><div class="brand-mark">W</div><div class="brand-copy"><strong>Webster WAVE</strong><span>Command Centre</span></div><button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle sidebar">${sidebarCollapsed ? "›" : "‹"}</button></div>
      <nav class="side-nav">${[["overview","⌂","Overview"],["planner","▦","Planner"],["activities","✓","Activities"],["settings","⚙","Settings"]].map(([key,icon,label]) => `<button class="${activeModule === key ? "active" : ""}" data-module="${key}"><i>${icon}</i><span>${label}</span></button>`).join("")}</nav>
      <div class="sidebar-foot"><div class="workspace-badge"><span>WS</span><div><strong>Webster Solutions</strong><small>Private workspace</small></div></div></div>
    </aside>
    <div class="app-main"><header class="topbar"><button class="mobile-menu" id="mobileMenu">☰</button><div class="page-heading"><h1>${title}</h1><p>${description}</p></div><div class="top-actions"><button class="icon-action" id="notificationButton" aria-label="Notifications">♢${notifications.length ? `<b>${notifications.length}</b>` : ""}</button><button class="button primary" id="addTop">＋ New activity</button><div class="profile-wrap"><button class="profile-button" id="profileButton"><span>${escapeHtml(initials(state.profile.name))}</span><div><strong>${escapeHtml(state.profile.name)}</strong><small>${escapeHtml(state.profile.role)}</small></div><i>⌄</i></button><div class="popover profile-menu hidden" id="profileMenu"><button data-profile-settings>My profile</button><button id="signOut">Sign out</button></div></div></div></header>
      <main class="content" id="viewRoot"></main><footer class="footer"><span>Webster Actions, Visibility & Execution</span><span>One shared planning system · Saved privately in this browser</span></footer>
    </div><div class="mobile-scrim hidden" id="mobileScrim"></div>
    <div class="popover notifications-popover hidden" id="notificationsPopover"><header><strong>Notifications</strong><span>${notifications.length} open</span></header>${notifications.length ? notifications.slice(0, 6).map((item) => `<button data-notification="${item.id}"><i class="${item.type}"></i><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.help)}</small></span></button>`).join("") : '<p class="empty-copy">You’re all caught up.</p>'}</div>
  </div>`;

  if (activeModule === "overview") renderOverview();
  else if (activeModule === "planner") renderPlanner();
  else if (activeModule === "activities") renderActivities();
  else renderSettings();
  bindShellEvents();
}

function bindShellEvents() {
  document.querySelector("#addTop").addEventListener("click", () => showActivityForm(null, selectedDate));
  document.querySelectorAll("[data-module]").forEach((button) => button.addEventListener("click", () => { activeModule = button.dataset.module; closeMobileSidebar(); render(); }));
  document.querySelector("#sidebarToggle").addEventListener("click", () => { sidebarCollapsed = !sidebarCollapsed; localStorage.setItem(UI_KEY, JSON.stringify({ sidebarCollapsed })); render(); });
  document.querySelector("#mobileMenu").addEventListener("click", () => { document.querySelector("#sidebar").classList.add("mobile-open"); document.querySelector("#mobileScrim").classList.remove("hidden"); });
  document.querySelector("#mobileScrim").addEventListener("click", closeMobileSidebar);
  document.querySelector("#notificationButton").addEventListener("click", (event) => { event.stopPropagation(); document.querySelector("#notificationsPopover").classList.toggle("hidden"); document.querySelector("#profileMenu").classList.add("hidden"); });
  document.querySelector("#profileButton").addEventListener("click", (event) => { event.stopPropagation(); document.querySelector("#profileMenu").classList.toggle("hidden"); document.querySelector("#notificationsPopover").classList.add("hidden"); });
  document.querySelector("[data-profile-settings]").addEventListener("click", () => { activeModule = "settings"; render(); });
  document.querySelector("#signOut").addEventListener("click", () => { localStorage.removeItem(SESSION_KEY); render(); });
  document.querySelectorAll("[data-notification]").forEach((button) => button.addEventListener("click", () => showActivityDetail(button.dataset.notification)));
}

function initials(name) { return String(name || "W").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function closeMobileSidebar() { document.querySelector("#sidebar")?.classList.remove("mobile-open"); document.querySelector("#mobileScrim")?.classList.add("hidden"); }
function notificationItems() {
  return state.activities.filter((activity) => isFollowUpDue(activity) || (activity.date <= today() && progress(activity) < 100 && activity.priority === "High")).map((activity) => ({ id: activity.id, title: activity.title, help: isFollowUpDue(activity) ? `Follow-up due ${niceDate(activity.followUpDate)}` : `High priority · ${niceDate(activity.date)}`, type: isFollowUpDue(activity) ? "followup" : "priority" }));
}

function renderLogin() {
  app.innerHTML = `<section class="login-screen"><div class="login-brand-panel"><div class="login-brand"><div class="brand-mark">W</div><span>Webster WAVE</span></div><div class="login-promise"><span class="login-kicker">Business Development Command Centre</span><h1>Turn every opportunity into deliberate action.</h1><p>One connected workspace for planning, publishing, follow-ups and execution across Webster.</p><div class="login-proof"><span>✓ Eight growth verticals</span><span>✓ Connected weekly and monthly planning</span><span>✓ Private browser-based workspace</span></div></div><div class="login-footer">Webster Actions, Visibility & Execution</div></div><div class="login-form-panel"><form class="login-card" id="loginForm"><div class="login-mobile-brand"><div class="brand-mark">W</div><strong>Webster WAVE</strong></div><span class="eyebrow">Private workspace</span><h2>Welcome back</h2><p>Sign in to continue to your command centre.</p><label class="field">Your name<input id="loginName" required value="${escapeHtml(state.profile.name)}" placeholder="Vishal Dudhal"/></label><label class="field">Work email<input id="loginEmail" type="email" value="${escapeHtml(state.profile.email)}" placeholder="you@webster.co.in"/></label><button class="button primary login-submit">Continue to WAVE →</button><small>Your planning data stays in this browser. No password or cloud account is required yet.</small></form></div></section>`;
  document.querySelector("#loginForm").addEventListener("submit", (event) => { event.preventDefault(); state.profile.name = document.querySelector("#loginName").value.trim() || DEFAULT_OWNER; state.profile.email = document.querySelector("#loginEmail").value.trim(); if (!state.team.includes(state.profile.name)) state.team.push(state.profile.name); save(); localStorage.setItem(SESSION_KEY, "active"); render(); });
}

function renderCommandStrip() {
  const metrics = commandMetrics();
  const cards = [["today", "Today", metrics.today.length, "Activities to execute"], ["pending", "Pending", metrics.pending.length, "Open through today"], ["followups", "Follow-ups", metrics.followUps.length, "Due for attention"], ["completed", "Completed", metrics.completed.length, "Finished today"]];
  document.querySelector("#commandStrip").innerHTML = `<div class="command-intro"><span class="pulse"></span><div><strong>${weekDay(today())}, ${niceDate(today())}</strong><small>Live daily execution overview</small></div></div><div class="metric-grid">${cards.map(([key, label, count, help]) => `<button class="metric-card ${key}" data-metric="${key}"><span class="metric-label">${label}</span><strong>${count}</strong><small>${help}</small></button>`).join("")}</div>`;
  document.querySelectorAll("[data-metric]").forEach((button) => button.addEventListener("click", () => { selectedDate = today(); monthStart = firstOfMonth(); weekStart = startOfWeek(); render(); }));
}

function periodActivities(start, end) { return state.activities.filter((activity) => activity.date >= start && activity.date <= end); }
function completionRate(activities) { return activities.length ? Math.round(activities.reduce((sum, activity) => sum + progress(activity), 0) / activities.length) : 0; }

function renderOverview() {
  const current = today();
  const metrics = commandMetrics();
  const week = periodActivities(startOfWeek(), endOfWeek());
  const month = periodActivities(firstOfMonth(), lastOfMonth(firstOfMonth()));
  const upcoming = state.activities.filter((activity) => activity.date >= current && progress(activity) < 100).sort((a, b) => a.date.localeCompare(b.date) || PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)).slice(0, 6);
  const carried = state.activities.filter((activity) => isCarried(activity) && progress(activity) < 100);
  const verticalStats = state.verticals.map((vertical) => { const items = month.filter((activity) => activity.vertical === vertical); return { vertical, count: items.length, rate: completionRate(items) }; }).filter((item) => item.count).sort((a, b) => b.count - a.count).slice(0, 6);
  document.querySelector("#viewRoot").innerHTML = `<section class="overview-hero"><div><span class="date-chip">${weekDay(current)}, ${niceDate(current, { year: "numeric" })}</span><h2>Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${escapeHtml(state.profile.name.split(" ")[0])}.</h2><p>${metrics.today.length ? `You have ${metrics.today.length} open ${metrics.today.length === 1 ? "priority" : "priorities"} today.` : "Your runway is clear. Plan the next meaningful move."}</p></div><div class="quick-actions"><button class="button primary" data-quick-add>＋ Add activity</button><button class="button" data-open-planner>Open planner</button><button class="button" data-briefing>☀ Briefing</button></div></section>
    <section class="metric-cards">${[["Today",metrics.today.length,"Open priorities","today"],["Pending",metrics.pending.length,"Through today","pending"],["Carried",carried.length,"Moved forward","carried"],["Completed",metrics.completed.length,"Finished today","completed"]].map(([label,value,help,key]) => `<button class="overview-metric ${key}" data-metric-card="${key}"><span>${label}</span><strong>${value}</strong><small>${help}</small><i>↗</i></button>`).join("")}</section>
    <section class="overview-grid"><article class="surface priority-panel"><header class="surface-head"><div><span class="section-kicker">Daily focus</span><h3>Today’s priorities</h3></div><button data-view-activities>View all</button></header><div class="priority-list">${metrics.today.length ? metrics.today.sort((a,b) => PRIORITIES.indexOf(a.priority)-PRIORITIES.indexOf(b.priority)).slice(0,5).map((activity) => overviewActivityRow(activity)).join("") : emptyBlock("✓", "Nothing pending today", "Use this space to plan the next action.")}</div></article>
      <article class="surface progress-panel"><header class="surface-head"><div><span class="section-kicker">Momentum</span><h3>Progress snapshot</h3></div></header><div class="progress-rings"><div class="ring" style="--value:${completionRate(week)}"><strong>${completionRate(week)}%</strong><span>This week</span></div><div class="ring" style="--value:${completionRate(month)}"><strong>${completionRate(month)}%</strong><span>This month</span></div></div><div class="mini-stat-row"><span><b>${week.length}</b> weekly activities</span><span><b>${month.length}</b> monthly activities</span></div></article>
      <article class="surface upcoming-panel"><header class="surface-head"><div><span class="section-kicker">Next up</span><h3>Upcoming & follow-ups</h3></div><span>${metrics.followUps.length} due</span></header><div class="timeline-list">${upcoming.length ? upcoming.map((activity) => `<button data-activity="${activity.id}"><time><strong>${parseDate(activity.date).getDate()}</strong><span>${parseDate(activity.date).toLocaleDateString("en-IN",{month:"short"})}</span></time><span><strong>${escapeHtml(activity.title)}</strong><small>${escapeHtml(activity.vertical)} · ${escapeHtml(activity.owner)}</small></span>${isFollowUpDue(activity) ? '<i>Follow-up</i>' : ""}</button>`).join("") : emptyBlock("○", "No upcoming activities", "Your future plan is open.")}</div></article>
      <article class="surface vertical-panel"><header class="surface-head"><div><span class="section-kicker">This month</span><h3>Vertical-wise progress</h3></div></header><div class="vertical-progress">${verticalStats.length ? verticalStats.map((item) => `<div><span><strong>${escapeHtml(item.vertical)}</strong><small>${item.count} activities</small></span><div class="bar"><i style="width:${item.rate}%"></i></div><b>${item.rate}%</b></div>`).join("") : emptyBlock("▥", "No monthly activity yet", "Add activities to see progress by vertical.")}</div></article></section>`;
  document.querySelector("[data-quick-add]").addEventListener("click", () => showActivityForm());
  document.querySelector("[data-open-planner]").addEventListener("click", () => { activeModule = "planner"; render(); });
  document.querySelector("[data-briefing]").addEventListener("click", () => showReminder(true));
  document.querySelectorAll("[data-view-activities],[data-metric-card]").forEach((button) => button.addEventListener("click", () => { activeModule = "activities"; render(); }));
  document.querySelectorAll("[data-activity]").forEach((button) => button.addEventListener("click", () => showActivityDetail(button.dataset.activity)));
}

function overviewActivityRow(activity) { return `<button class="priority-row" data-activity="${activity.id}"><i class="priority-dot ${priorityClass(activity.priority)}"></i><span><strong>${escapeHtml(activity.title)}</strong><small>${escapeHtml(activity.vertical)} · ${progress(activity)}% complete</small></span><em>${escapeHtml(activity.owner)}</em><b>›</b></button>`; }
function emptyBlock(icon, title, copy) { return `<div class="module-empty"><i>${icon}</i><strong>${title}</strong><span>${copy}</span></div>`; }

function renderPlanner() {
  document.querySelector("#viewRoot").innerHTML = `<section class="module-toolbar"><div class="view-switch"><button class="${viewMode === "week" ? "active" : ""}" data-view="week">Weekly Planner</button><button class="${viewMode === "month" ? "active" : ""}" data-view="month">Monthly Calendar</button></div><div class="planner-filters">${["All","Marketing","Business Development"].map((filter) => `<button class="${plannerFilter === filter ? "active" : ""}" data-planner-filter="${filter}">${filter}</button>`).join("")}</div><div class="filters"><label>Owner<select id="ownerFilter">${optionList(state.team, ownerFilter, true)}</select></label><label>Status<select id="statusFilter">${optionList(STATUSES, statusFilter, true)}</select></label></div></section><div id="plannerRoot"></div>`;
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { viewMode = button.dataset.view; render(); }));
  document.querySelectorAll("[data-planner-filter]").forEach((button) => button.addEventListener("click", () => { plannerFilter = button.dataset.plannerFilter; render(); }));
  document.querySelector("#ownerFilter").addEventListener("change", (event) => { ownerFilter = event.target.value; render(); });
  document.querySelector("#statusFilter").addEventListener("change", (event) => { statusFilter = event.target.value; render(); });
  if (viewMode === "month") renderMonthView(); else renderWeekView();
}

function renderActivities() {
  const activities = filteredActivities().filter((activity) => !activitySearch || `${activity.title} ${activity.topic} ${activity.vertical} ${activity.owner}`.toLowerCase().includes(activitySearch.toLowerCase())).sort((a,b) => b.date.localeCompare(a.date));
  document.querySelector("#viewRoot").innerHTML = `<section class="module-toolbar activity-toolbar"><label class="search-box">⌕<input id="activitySearch" placeholder="Search activities, owners or verticals" value="${escapeHtml(activitySearch)}"/></label><div class="filters"><label>Vertical<select id="verticalFilter">${optionList(state.verticals, verticalFilter, true)}</select></label><label>Status<select id="statusFilter">${optionList(STATUSES, statusFilter, true)}</select></label><label>Owner<select id="ownerFilter">${optionList(state.team, ownerFilter, true)}</select></label></div></section><section class="surface activity-manager"><header class="activity-table-head"><span>Activity</span><span>Vertical</span><span>Owner</span><span>Scheduled</span><span>Status</span><span>Progress</span></header><div class="activity-table-body">${activities.length ? activities.map((activity) => `<button class="activity-table-row" data-activity="${activity.id}"><span class="activity-name"><i class="priority-dot ${priorityClass(activity.priority)}"></i><span><strong>${escapeHtml(activity.title)}</strong><small>${escapeHtml(activity.topic || activity.platform || "No additional context")}</small></span></span><span data-label="Vertical">${escapeHtml(activity.vertical)}</span><span data-label="Owner"><i class="avatar-mini">${escapeHtml(initials(activity.owner))}</i>${escapeHtml(activity.owner)}</span><span data-label="Scheduled">${niceDate(activity.date, { year:"numeric" })}</span><span data-label="Status"><i class="status-pill ${statusClass(activity)}">${statusOf(activity)}</i></span><span data-label="Progress"><span class="table-progress"><i style="width:${progress(activity)}%"></i></span><b>${progress(activity)}%</b></span></button>`).join("") : emptyBlock("⌕", "No matching activities", "Adjust the search or filters.")}</div><footer class="table-footer"><span>${activities.length} activities</span><span>${activities.filter((item) => progress(item) === 100).length} completed</span></footer></section>`;
  document.querySelector("#activitySearch").addEventListener("input", (event) => { activitySearch = event.target.value; renderActivities(); });
  [["verticalFilter","verticalFilter"],["statusFilter","statusFilter"],["ownerFilter","ownerFilter"]].forEach(([id,key]) => document.querySelector(`#${id}`).addEventListener("change", (event) => { if (key === "verticalFilter") verticalFilter = event.target.value; if (key === "statusFilter") statusFilter = event.target.value; if (key === "ownerFilter") ownerFilter = event.target.value; renderActivities(); }));
  document.querySelectorAll("[data-activity]").forEach((button) => button.addEventListener("click", () => showActivityDetail(button.dataset.activity)));
}

function renderSettings() {
  const workingDays = [[1,"Mon"],[2,"Tue"],[3,"Wed"],[4,"Thu"],[5,"Fri"],[6,"Sat"],[0,"Sun"]];
  document.querySelector("#viewRoot").innerHTML = `<div class="settings-grid"><section class="surface settings-card"><header><span class="settings-icon">◉</span><div><h3>My profile</h3><p>Personalize your WAVE workspace.</p></div></header><form class="settings-form" id="profileForm"><label class="field">Name<input id="profileName" required value="${escapeHtml(state.profile.name)}"/></label><label class="field">Work email<input id="profileEmail" type="email" value="${escapeHtml(state.profile.email)}"/></label><label class="field span-2">Role<input id="profileRole" value="${escapeHtml(state.profile.role)}"/></label><button class="button primary span-2">Save profile</button></form></section>
    <section class="surface settings-card"><header><span class="settings-icon">♙</span><div><h3>Team members</h3><p>Manage people available for assignment.</p></div></header><div class="settings-list" id="teamList">${state.team.map((member) => `<div><i class="avatar-mini">${escapeHtml(initials(member))}</i><strong>${escapeHtml(member)}</strong>${member !== state.profile.name ? `<button data-remove-team="${escapeHtml(member)}">×</button>` : '<span class="you-tag">You</span>'}</div>`).join("")}</div><form class="inline-add" id="teamForm"><input id="newTeamMember" required placeholder="Add team member"/><button class="button">Add</button></form></section>
    <section class="surface settings-card wide"><header><span class="settings-icon">▦</span><div><h3>Verticals & activity templates</h3><p>Keep the eight core verticals and tailor their execution checklists.</p></div></header><div class="template-grid">${state.verticals.map((vertical) => `<div><span><strong>${escapeHtml(vertical)}</strong><small>${(state.templates[vertical] || []).length} template steps</small></span><button class="button compact" data-edit-template="${escapeHtml(vertical)}">Edit template</button>${!Object.hasOwn(VERTICAL_TEMPLATES, vertical) ? `<button class="icon-danger" data-remove-vertical="${escapeHtml(vertical)}">×</button>` : ""}</div>`).join("")}</div><form class="inline-add" id="verticalForm"><input id="newVertical" required placeholder="Add a custom vertical"/><button class="button">Add vertical</button></form></section>
    <section class="surface settings-card"><header><span class="settings-icon">◫</span><div><h3>Working days & holidays</h3><p>Control automatic carry-forward days.</p></div></header><div class="day-toggles">${workingDays.map(([value,label]) => `<label><input type="checkbox" data-working-day value="${value}" ${state.settings.workingDays.includes(value) ? "checked" : ""}/><span>${label}</span></label>`).join("")}</div><div class="holiday-list">${state.settings.holidays.length ? state.settings.holidays.map((date) => `<span>${niceDate(date,{year:"numeric"})}<button data-remove-holiday="${date}">×</button></span>`).join("") : '<p class="empty-copy">No holidays added.</p>'}</div><form class="inline-add" id="holidayForm"><input id="holidayDate" type="date" required/><button class="button">Add holiday</button></form></section>
    <section class="surface settings-card"><header><span class="settings-icon">♢</span><div><h3>Reminder preferences</h3><p>Choose when WAVE prepares the daily briefing.</p></div></header><label class="settings-toggle"><span><strong>Morning briefing</strong><small>Show priorities and due follow-ups</small></span><input id="reminderEnabled" type="checkbox" ${state.settings.reminderEnabled ? "checked" : ""}/><i></i></label><label class="field">Briefing time<input id="reminderTime" type="time" value="${state.settings.reminderTime}"/></label></section>
    <section class="surface settings-card wide demo-settings"><header><span class="settings-icon">✦</span><div><h3>Demo workspace</h3><p>Load a realistic Webster plan across every vertical and publishing channel.</p></div><button class="button" id="loadDemoData">Load demo data</button></header><p>Includes daily priorities, completed and carried work, follow-ups, recurring reviews, multi-channel content, owners, notes, outcomes, and upcoming activities. Your profile and workspace preferences are preserved.</p></section>
    <section class="surface settings-card wide data-settings"><header><span class="settings-icon">↕</span><div><h3>Data backup & restore</h3><p>Download a complete portable copy or restore a previous WAVE workspace.</p></div><button class="button primary" id="openDataTools">Open backup tools</button></header><div class="data-facts"><span><strong>${state.activities.length}</strong> activities</span><span><strong>${state.recurrences.length}</strong> recurring schedules</span><span><strong>${state.team.length}</strong> team members</span></div></section></div>`;
  bindSettingsEvents();
}

function bindSettingsEvents() {
  document.querySelector("#profileForm").addEventListener("submit", (event) => { event.preventDefault(); const previous = state.profile.name; state.profile = { name: document.querySelector("#profileName").value.trim() || DEFAULT_OWNER, email: document.querySelector("#profileEmail").value.trim(), role: document.querySelector("#profileRole").value.trim() || "Business Development" }; if (!state.team.includes(state.profile.name)) state.team.push(state.profile.name); if (previous !== state.profile.name) state.team = state.team.filter((name) => name !== previous || state.activities.some((activity) => activity.owner === previous)); save(); render(); });
  document.querySelector("#teamForm").addEventListener("submit", (event) => { event.preventDefault(); const value = document.querySelector("#newTeamMember").value.trim(); if (value && !state.team.includes(value)) state.team.push(value); save(); render(); });
  document.querySelectorAll("[data-remove-team]").forEach((button) => button.addEventListener("click", () => { const member = button.dataset.removeTeam; if (state.activities.some((activity) => activity.owner === member)) return window.alert("Reassign this person’s activities before removing them."); state.team = state.team.filter((item) => item !== member); save(); render(); }));
  document.querySelector("#verticalForm").addEventListener("submit", (event) => { event.preventDefault(); const value = document.querySelector("#newVertical").value.trim(); if (value && !state.verticals.includes(value)) { state.verticals.push(value); state.templates[value] = []; } save(); render(); });
  document.querySelectorAll("[data-remove-vertical]").forEach((button) => button.addEventListener("click", () => { const vertical = button.dataset.removeVertical; if (state.activities.some((activity) => activity.vertical === vertical)) return window.alert("Move this vertical’s activities before removing it."); state.verticals = state.verticals.filter((item) => item !== vertical); delete state.templates[vertical]; save(); render(); }));
  document.querySelectorAll("[data-edit-template]").forEach((button) => button.addEventListener("click", () => showTemplateEditor(button.dataset.editTemplate)));
  document.querySelectorAll("[data-working-day]").forEach((input) => input.addEventListener("change", () => { const values = [...document.querySelectorAll("[data-working-day]:checked")].map((item) => Number(item.value)); if (!values.length) { input.checked = true; return window.alert("Keep at least one working day."); } state.settings.workingDays = values; save(); }));
  document.querySelector("#holidayForm").addEventListener("submit", (event) => { event.preventDefault(); const value = document.querySelector("#holidayDate").value; if (value && !state.settings.holidays.includes(value)) state.settings.holidays.push(value); state.settings.holidays.sort(); save(); render(); });
  document.querySelectorAll("[data-remove-holiday]").forEach((button) => button.addEventListener("click", () => { state.settings.holidays = state.settings.holidays.filter((date) => date !== button.dataset.removeHoliday); save(); render(); }));
  document.querySelector("#reminderEnabled").addEventListener("change", (event) => { state.settings.reminderEnabled = event.target.checked; save(); });
  document.querySelector("#reminderTime").addEventListener("change", (event) => { state.settings.reminderTime = event.target.value || "10:00"; save(); });
  document.querySelector("#loadDemoData").addEventListener("click", () => {
    if (!window.confirm("Replace the current activity plan with the WAVE demo workspace? Download a backup first if you need the current activities.")) return;
    loadDemoData(); ownerFilter = "All"; verticalFilter = "All"; statusFilter = "All"; plannerFilter = "All"; activitySearch = ""; selectedDate = today(); monthStart = firstOfMonth(); weekStart = startOfWeek(); activeModule = "overview"; render();
  });
  document.querySelector("#openDataTools").addEventListener("click", showDataTools);
}

function showTemplateEditor(vertical) {
  const items = state.templates[vertical] || [];
  openModal(`<article class="modal"><header class="modal-head"><div><div class="eyebrow">Activity template</div><h2>${escapeHtml(vertical)}</h2><p class="modal-description">Enter one checklist step per line. New activities use this template.</p></div><button class="close-button" data-close>×</button></header><form id="templateForm"><label class="field template-field">Checklist steps<textarea id="templateSteps" rows="10">${escapeHtml(items.join("\n"))}</textarea></label><div class="form-actions"><button class="button" type="button" data-close>Cancel</button><button class="button primary">Save template</button></div></form></article>`);
  overlay.querySelector("#templateForm").addEventListener("submit", (event) => { event.preventDefault(); state.templates[vertical] = overlay.querySelector("#templateSteps").value.split("\n").map((item) => item.trim()).filter(Boolean); save(); closeModal(); render(); });
}

function plannerActivities() {
  return filteredActivities().filter((activity) => plannerFilter === "All" || (plannerFilter === "Marketing" ? activity.vertical === "Marketing" : activity.vertical !== "Marketing"));
}

function renderMonthView() {
  const root = document.querySelector("#plannerRoot");
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
  const activities = plannerActivities();
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
  const activities = plannerActivities().filter((activity) => activity.date === selectedDate).sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
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
  const activities = plannerActivities();
  const dates = Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index));
  const businessRows = state.verticals.filter((vertical) => vertical !== "Marketing").map((vertical) => ({ label: vertical, type: "vertical", key: vertical }));
  const marketingRows = MARKETING_CHANNELS.map((channel) => ({ label: channel, type: "channel", key: channel }));
  const rows = [...(plannerFilter === "Business Development" ? [] : marketingRows), ...(plannerFilter === "Marketing" ? [] : businessRows)];
  const cellItems = (row, date) => activities.filter((activity) => {
    if (activity.date !== date) return false;
    if (row.type === "vertical") return activity.vertical === row.key;
    return activity.vertical === "Marketing" && (activity.publicationTargets.some((target) => target.channel === row.key) || (!activity.publicationTargets.length && activity.platform === row.key));
  });
  const grid = rows.map((row) => `<div class="planner-row-label"><i>${row.type === "channel" ? "M" : "BD"}</i><span><strong>${escapeHtml(row.label)}</strong><small>${row.type === "channel" ? "Publishing channel" : "Business development"}</small></span></div>${dates.map((date) => { const items = cellItems(row,date); return `<div class="planner-cell ${date === today() ? "today" : ""}"><div class="cell-items">${items.map((activity) => weeklyCard(activity,row)).join("")}</div><button class="cell-add" data-grid-add data-date="${date}" data-row="${escapeHtml(row.key)}" data-type="${row.type}">＋</button></div>`; }).join("")}`).join("");
  document.querySelector("#plannerRoot").innerHTML = `<section class="surface weekly-board"><header class="panel-header"><div><span class="section-kicker">Connected execution board</span><h2>Week of ${niceDate(weekStart)}</h2><div class="small">${niceDate(weekStart)} – ${niceDate(end,{year:"numeric"})} · ${activities.filter((activity) => activity.date >= weekStart && activity.date <= end).length} parent activities</div></div><div class="period-actions"><button class="button icon-button" id="previousWeek">‹</button><button class="button today-button" id="currentWeek">This week</button><button class="button icon-button" id="nextWeek">›</button></div></header><div class="planner-grid-wrap"><div class="planner-matrix"><div class="planner-corner">Channel / Vertical</div>${dates.map((date) => `<div class="planner-day ${date === today() ? "today" : ""}"><strong>${weekDay(date,true)}</strong><span>${niceDate(date)}</span></div>`).join("")}${grid}</div></div><footer class="weekly-summary"><span>Multiple channel cards can reference one parent activity</span><span>Titles and publishing status edit inline</span></footer></section>`;
  document.querySelector("#previousWeek").addEventListener("click", () => { weekStart = shiftDate(weekStart, -7); selectedDate = weekStart; render(); });
  document.querySelector("#nextWeek").addEventListener("click", () => { weekStart = shiftDate(weekStart, 7); selectedDate = weekStart; render(); });
  document.querySelector("#currentWeek").addEventListener("click", () => { weekStart = startOfWeek(); selectedDate = today(); render(); });
  document.querySelectorAll("[data-grid-add]").forEach((button) => button.addEventListener("click", () => showActivityForm(null, button.dataset.date, { row: button.dataset.row, type: button.dataset.type })));
  document.querySelectorAll("[data-weekly-open]").forEach((button) => button.addEventListener("click", () => showActivityDetail(button.dataset.weeklyOpen)));
  document.querySelectorAll("[data-inline-title]").forEach((input) => input.addEventListener("change", () => { const activity = state.activities.find((item) => item.id === input.dataset.inlineTitle); if (!activity || !input.value.trim()) return; activity.title = input.value.trim(); activity.updatedAt = new Date().toISOString(); save(); }));
  document.querySelectorAll("[data-publish-status]").forEach((select) => select.addEventListener("change", () => { const activity = state.activities.find((item) => item.id === select.dataset.publishStatus); const target = activity?.publicationTargets.find((item) => item.channel === select.dataset.channel); if (!target) return; target.status = select.value; activity.updatedAt = new Date().toISOString(); save(); }));
}

function weeklyCard(activity, row) {
  const target = row.type === "channel" ? activity.publicationTargets.find((item) => item.channel === row.key) : null;
  return `<article class="week-card ${priorityClass(activity.priority)}"><div><input data-inline-title="${activity.id}" value="${escapeHtml(activity.title)}" aria-label="Activity title"/><button data-weekly-open="${activity.id}">↗</button></div><small>${escapeHtml(activity.owner)} · ${progress(activity)}%${row.key === "Blogs" && activity.blogType ? ` · ${escapeHtml(activity.blogType)}` : ""}</small>${target ? `<select data-publish-status="${activity.id}" data-channel="${escapeHtml(row.key)}">${PUBLISHING_STATUSES.map((status) => `<option ${target.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>` : `<span class="week-status ${statusClass(activity)}">${statusOf(activity)}</span>`}</article>`;
}

function openModal(content, drawer = false) {
  overlay.innerHTML = content;
  overlay.className = `overlay ${drawer ? "drawer-overlay" : ""}`;
  overlay.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModal));
  overlay.addEventListener("click", closeOnBackdrop);
  document.addEventListener("keydown", closeOnEscape);
}
function closeOnBackdrop(event) { if (event.target === overlay) closeModal(); }
function closeOnEscape(event) { if (event.key === "Escape") closeModal(); }
function closeModal() { overlay.className = "overlay hidden"; overlay.innerHTML = ""; overlay.removeEventListener("click", closeOnBackdrop); document.removeEventListener("keydown", closeOnEscape); }

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
    ${activity.publicationTargets.length ? `<section class="drawer-section"><div class="section-title"><h3>Publishing channels</h3><span>${activity.publicationTargets.length}</span></div><div class="publication-list">${activity.publicationTargets.map((target) => `<span><strong>${escapeHtml(target.channel)}</strong><i>${escapeHtml(target.status)}</i></span>`).join("")}</div></section>` : ""}
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

function showActivityForm(id = null, defaultDate = selectedDate, context = {}) {
  const activity = id ? state.activities.find((item) => item.id === id) : null;
  const schedule = getSchedule(activity);
  const editing = Boolean(activity);
  const initialVertical = activity?.vertical || (context.type === "vertical" ? context.row : "Marketing");
  let draftItems = activity ? activity.items.map((item) => ({ ...item })) : (state.templates[initialVertical] || []).map((label) => ({ id: uid(), label, done: false }));
  let draftAttachments = activity ? activity.attachments.map((file) => ({ ...file })) : [];
  let draftTargets = activity ? activity.publicationTargets.map((target) => ({ ...target })) : (context.type === "channel" ? [{ channel: context.row, status: "Scheduled" }] : []);
  const recurrenceFrequency = schedule?.frequency || "none";
  const recurringWeekdays = schedule?.weekdays || [];
  openModal(`<article class="modal form-modal wide-form" role="dialog" aria-modal="true"><header class="modal-head"><div><div class="eyebrow">${editing ? "Edit activity" : "New activity"}</div><h2>${editing ? "Update the plan" : "Plan an activity"}</h2><p class="modal-description">Monthly and weekly views update from this same activity record.</p></div><button class="close-button" data-close>×</button></header>
    <form class="form activity-form" id="activityForm">
      <label class="field span-2">Activity title<input id="activityTitle" required maxlength="120" placeholder="What needs to happen?" value="${escapeHtml(activity?.title || "")}"/></label>
      ${fieldSelect("Vertical", "activityVertical", state.verticals, initialVertical, "Add new vertical…")}
      ${fieldSelect("Assigned person", "activityOwner", state.team, activity?.owner || DEFAULT_OWNER, "Add new person…")}
      <label class="field">Scheduled date<input id="activityDate" type="date" required value="${activity?.date || defaultDate}"/></label>
      <label class="field">Priority<select id="activityPriority">${PRIORITIES.map((priority) => `<option ${activity?.priority === priority || (!activity && priority === "Medium") ? "selected" : ""}>${priority}</option>`).join("")}</select></label>
      <label class="field">Platform<input id="activityPlatform" list="platformSuggestions" maxlength="60" placeholder="e.g. LinkedIn" value="${escapeHtml(activity?.platform || "")}"/><datalist id="platformSuggestions">${PLATFORM_SUGGESTIONS.map((value) => `<option value="${value}">`).join("")}</datalist></label>
      <label class="field">Activity type<input id="activityType" list="typeSuggestions" maxlength="60" placeholder="e.g. Post, call, meeting" value="${escapeHtml(activity?.activityType || "")}"/><datalist id="typeSuggestions">${ACTIVITY_TYPE_SUGGESTIONS.map((value) => `<option value="${value}">`).join("")}</datalist></label>
      <section class="form-section span-2 ${initialVertical === "Marketing" ? "" : "hidden"}" id="publishingSection"><div class="section-title"><h3>Publishing channels</h3><span>One parent activity · individual channel status</span></div><div class="publishing-editor" id="publishingEditor"></div><label class="field blog-type-field ${activity?.blogType || context.row === "Blogs" ? "" : "hidden"}" id="blogTypeField">Blog stream<select id="blogType"><option value="">Choose blog stream</option>${BLOG_TYPES.map((type) => `<option ${activity?.blogType === type ? "selected" : ""}>${type}</option>`).join("")}</select></label></section>
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
  const publishingEditor = overlay.querySelector("#publishingEditor");

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
    overlay.querySelector("#publishingSection").classList.toggle("hidden", value !== "Marketing");
    const template = state.templates[value];
    if (template && (!editing || window.confirm("Replace this checklist with the selected vertical’s template?"))) { draftItems = template.map((label) => ({ id: uid(), label, done: false })); drawChecklist(); }
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
  function drawPublishing() {
    publishingEditor.innerHTML = MARKETING_CHANNELS.map((channel) => { const target = draftTargets.find((item) => item.channel === channel); return `<div class="publish-channel ${target ? "selected" : ""}"><label><input type="checkbox" data-publish-channel="${escapeHtml(channel)}" ${target ? "checked" : ""}/><span>${escapeHtml(channel)}</span></label><select data-publish-select="${escapeHtml(channel)}" ${target ? "" : "disabled"}>${PUBLISHING_STATUSES.map((status) => `<option ${target?.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div>`; }).join("");
    publishingEditor.querySelectorAll("[data-publish-channel]").forEach((input) => input.addEventListener("change", () => { if (input.checked) draftTargets.push({ channel: input.dataset.publishChannel, status: "Scheduled" }); else draftTargets = draftTargets.filter((item) => item.channel !== input.dataset.publishChannel); drawPublishing(); }));
    publishingEditor.querySelectorAll("[data-publish-select]").forEach((select) => select.addEventListener("change", () => { const target = draftTargets.find((item) => item.channel === select.dataset.publishSelect); if (target) target.status = select.value; }));
    overlay.querySelector("#blogTypeField").classList.toggle("hidden", !draftTargets.some((item) => item.channel === "Blogs"));
  }
  drawChecklist(); drawAttachments(); drawPublishing();
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
      category: overlay.querySelector("#activityCategory").value.trim(), blogType: overlay.querySelector("#blogType").value, topic: overlay.querySelector("#activityTopic").value.trim(),
      additionalDetails: overlay.querySelector("#additionalDetails").value.trim(), notes: overlay.querySelector("#activityNotes").value.trim(),
      outcome: overlay.querySelector("#activityOutcome").value.trim(), resources: overlay.querySelector("#activityResources").value.trim(),
      followUpDate: overlay.querySelector("#followUpDate").value, fixed: overlay.querySelector("#fixedDate").checked,
      attachments: draftAttachments, publicationTargets: vertical === "Marketing" ? draftTargets : [], items: draftItems.filter((item) => item.label.trim()).map((item) => ({ ...item, label: item.label.trim() })),
    };
    const recurrence = { frequency: recurrenceSelect.value, until: overlay.querySelector("#recurrenceUntil").value, weekdays: [...overlay.querySelectorAll("#weekdayPicker input:checked")].map((input) => Number(input.value)) };
    const saved = editing ? updateActivity(id, payload, { recurrence, scope: overlay.querySelector("#editScope")?.value || "occurrence" }) : addActivity(payload, recurrence);
    selectedDate = saved.date; monthStart = firstOfMonth(saved.date); weekStart = startOfWeek(saved.date); closeModal(); render();
  });
}

function showReminder(force = false) {
  const current = today(); const now = new Date();
  const [reminderHour, reminderMinute] = state.settings.reminderTime.split(":").map(Number);
  const beforeReminder = now.getHours() * 60 + now.getMinutes() < reminderHour * 60 + reminderMinute;
  if (!force && (!state.settings.reminderEnabled || beforeReminder || localStorage.getItem(`${DISMISS_KEY}${current}`) === "1")) return;
  const metrics = commandMetrics();
  if (!metrics.today.length && !metrics.followUps.length && !force) return;
  reminderShown = true;
  const focus = [...metrics.today].sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
  openModal(`<article class="modal briefing"><header class="modal-head"><div class="briefing-icon">☀</div><button class="close-button" data-dismiss-reminder>×</button></header><div class="eyebrow">${escapeHtml(state.settings.reminderTime)} daily briefing</div><h2>Here’s the WAVE.</h2><p class="modal-description">${metrics.today.length} open today · ${metrics.followUps.length} follow-ups due · ${metrics.completed.length} completed</p><div class="briefing-focus"><span>Priority focus</span>${focus.length ? focus.slice(0, 5).map((activity) => `<button data-open-briefing="${activity.id}"><i class="priority-dot ${priorityClass(activity.priority)}"></i><span><strong>${escapeHtml(activity.title)}</strong><small>${escapeHtml(activity.owner)} · ${progress(activity)}%</small></span></button>`).join("") : '<p class="empty-copy">Nothing pending today.</p>'}</div>${metrics.followUps.length ? `<div class="briefing-callout"><strong>${metrics.followUps.length} follow-up${metrics.followUps.length === 1 ? "" : "s"} need attention</strong><span>Keep active conversations moving.</span></div>` : ""}<div class="reminder-actions"><button class="button" data-dismiss-reminder>Dismiss</button><button class="button primary" id="showToday">Open today</button></div></article>`);
  const dismiss = () => { localStorage.setItem(`${DISMISS_KEY}${current}`, "1"); closeModal(); };
  overlay.querySelectorAll("[data-dismiss-reminder]").forEach((button) => button.addEventListener("click", dismiss));
  overlay.querySelectorAll("[data-open-briefing]").forEach((button) => button.addEventListener("click", () => showActivityDetail(button.dataset.openBriefing)));
  overlay.querySelector("#showToday").addEventListener("click", () => { dismiss(); selectedDate = current; monthStart = firstOfMonth(); weekStart = startOfWeek(); activeModule = "planner"; viewMode = "month"; render(); });
}

syncRecurrences();
carryForward();
save();
render();
if (localStorage.getItem(SESSION_KEY) === "active") showReminder();
setInterval(() => {
  carryForward();
  if (localStorage.getItem(SESSION_KEY) === "active" && !reminderShown) showReminder();
}, 30_000);
