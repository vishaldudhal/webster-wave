import "./styles.css";
import "./typography.css";
import { BLOG_TYPES, CATEGORY_SUGGESTIONS, CONTENT_FORMATS, DEFAULT_OWNER, DISMISS_KEY, MARKETING_CHANNELS, PLATFORM_SUGGESTIONS, PRIORITIES, PUBLISHING_STATUSES, SESSION_KEY, STATUSES, UI_KEY, VERTICAL_TEMPLATES } from "./config.js";
import { daysInMonth, endOfWeek, firstOfMonth, lastOfMonth, monthTitle, niceDate, parseDate, shiftDate, shiftMonth, startOfWeek, today, weekDay } from "./dates.js";
import { addActivity, carryForward, createBackup, deleteActivity, getSchedule, isFollowUpDue, loadDemoData, progress, restoreBackup, save, state, statusOf, syncRecurrences, uid, updateActivity } from "./store.js";

const UI_DEFAULTS = {
  activeModule: "overview",
  viewMode: state.settings.defaultPlannerView || "week",
  monthStart: firstOfMonth(),
  weekStart: startOfWeek(),
  selectedDate: today(),
  plannerFilter: "All",
  activitySearch: "",
  ownerFilter: "All",
  verticalFilter: "All",
  statusFilter: "All",
  sidebarCollapsed: false,
  settingsSection: "profile",
};

function readUiPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
    const date = (value, fallback) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(parseDate(value).getTime()) ? value : fallback;
    return {
      activeModule: ["overview", "planner", "settings"].includes(stored.activeModule) ? stored.activeModule : stored.activeModule === "activities" ? "planner" : UI_DEFAULTS.activeModule,
      viewMode: ["week", "month", "activities"].includes(stored.viewMode) ? stored.viewMode : stored.activeModule === "activities" ? "activities" : UI_DEFAULTS.viewMode,
      monthStart: firstOfMonth(date(stored.monthStart, UI_DEFAULTS.monthStart)),
      weekStart: startOfWeek(date(stored.weekStart, UI_DEFAULTS.weekStart)),
      selectedDate: date(stored.selectedDate, UI_DEFAULTS.selectedDate),
      plannerFilter: ["All", "Marketing", "Business Development"].includes(stored.plannerFilter) ? stored.plannerFilter : UI_DEFAULTS.plannerFilter,
      activitySearch: typeof stored.activitySearch === "string" ? stored.activitySearch : UI_DEFAULTS.activitySearch,
      ownerFilter: typeof stored.ownerFilter === "string" ? stored.ownerFilter : UI_DEFAULTS.ownerFilter,
      verticalFilter: typeof stored.verticalFilter === "string" ? stored.verticalFilter : UI_DEFAULTS.verticalFilter,
      statusFilter: ["All", ...STATUSES].includes(stored.statusFilter) ? stored.statusFilter : UI_DEFAULTS.statusFilter,
      sidebarCollapsed: stored.sidebarCollapsed === true,
      settingsSection: ["profile", "team", "templates", "preferences", "notifications", "integrations", "data"].includes(stored.settingsSection) ? stored.settingsSection : UI_DEFAULTS.settingsSection,
    };
  } catch {
    return { ...UI_DEFAULTS };
  }
}

const uiPreferences = readUiPreferences();
let { activeModule, viewMode, monthStart, weekStart, selectedDate, plannerFilter, activitySearch, ownerFilter, verticalFilter, statusFilter, sidebarCollapsed, settingsSection } = uiPreferences;
let settingsTemplateTab = "verticals";
if (ownerFilter !== "All" && !state.team.includes(ownerFilter)) ownerFilter = "All";
if (verticalFilter !== "All" && !state.verticals.includes(verticalFilter)) verticalFilter = "All";
let reminderShown = false;

function saveUiPreferences() {
  localStorage.setItem(UI_KEY, JSON.stringify({ activeModule, viewMode, monthStart, weekStart, selectedDate, plannerFilter, activitySearch, ownerFilter, verticalFilter, statusFilter, sidebarCollapsed, settingsSection }));
}

const app = document.querySelector("#app");
const overlay = document.querySelector("#overlay");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const priorityClass = (priority) => String(priority || "Medium").toLowerCase();
const statusClass = (activity) => statusOf(activity).toLowerCase().replace(" ", "-");
const isCarried = (activity) => activity.history.some((entry) => entry.type === "carried" || entry.from);
const momentumMark = (className = "momentum-mark") => `<img class="${className}" src="/brand/wave-momentum-mark.svg" alt=""/>`;
const momentumLockup = () => `<span class="wave-lockup" role="img" aria-label="wave">${momentumMark()}<strong>wave</strong></span>`;
const ICON_PATHS = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  planner: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  activities: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.36.33.7.6 1 .3.28.68.42 1.1.4H21v4h-.09c-.42-.02-.8.12-1.1.4-.28.3-.48.64-.6 1Z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  collapse: '<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 9l-3 3 3 3M12 12h9"/>',
  expand: '<path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 9l3 3-3 3M12 12H3"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
const icon = (name, className = "") => `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ""}</svg>`;

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
  saveUiPreferences();
  if (localStorage.getItem(SESSION_KEY) !== "active") { renderLogin(); return; }
  ensureVisibleRecurrences();
  const notifications = notificationItems();
  const moduleTitles = { overview: ["Overview", `${weekDay(today())}, ${niceDate(today(), { year: "numeric" })} · Live execution snapshot`], planner: ["Planner", "Plan, manage and track every activity in one connected workspace."], settings: ["Settings", "Configure your workspace, team and planning rules."] };
  const [title, description] = moduleTitles[activeModule];
  app.innerHTML = `<div class="saas-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}">
    <aside class="sidebar" id="sidebar"><div class="sidebar-brand">${momentumMark()}<div class="brand-copy"><strong>wave</strong><span>by Webster</span></div></div>
      <nav class="side-nav" aria-label="Primary navigation">${[["overview","Overview"],["planner","Planner"],["settings","Settings"]].map(([key,label]) => `<button class="${activeModule === key ? "active" : ""}" data-module="${key}" data-tooltip="${label}" aria-label="${label}">${icon(key, "nav-icon")}<span>${label}</span></button>`).join("")}</nav>
      <div class="sidebar-foot"><div class="sidebar-profile"><span>${state.profile.avatar ? `<img src="${escapeHtml(state.profile.avatar)}" alt=""/>` : escapeHtml(initials(state.profile.name))}</span><div><strong>${escapeHtml(state.profile.name)}</strong><small>${escapeHtml(state.profile.role)}</small></div></div><button class="sidebar-toggle" id="sidebarToggle" data-tooltip="${sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}" aria-label="${sidebarCollapsed ? "Expand" : "Collapse"} sidebar">${icon(sidebarCollapsed ? "expand" : "collapse")}</button></div>
    </aside>
    <div class="app-main"><header class="topbar"><button class="mobile-menu" id="mobileMenu" aria-label="Open navigation">${icon("menu")}</button><div class="page-heading"><h1>${title}</h1><p>${description}</p></div><div class="top-actions"><button class="icon-action" id="notificationButton" aria-label="Open notifications">${icon("bell")}${notifications.length ? `<b>${notifications.length}</b>` : ""}</button><div class="create-wrap"><button class="button primary" id="addTop">＋ New activity <span>⌄</span></button><div class="popover create-menu hidden" id="createMenu"><button data-create="activity"><i>✓</i><span><strong>Plan an Activity</strong><small>Calls, meetings, outreach and business development</small></span></button><button data-create="content"><i>◇</i><span><strong>Plan Content</strong><small>Social, blogs, creatives and video</small></span></button></div></div><div class="profile-wrap"><button class="profile-button" id="profileButton"><span>${state.profile.avatar ? `<img src="${escapeHtml(state.profile.avatar)}" alt=""/>` : escapeHtml(initials(state.profile.name))}</span><div><strong>${escapeHtml(state.profile.name)}</strong><small>${escapeHtml(state.profile.role)}</small></div><i>⌄</i></button><div class="popover profile-menu hidden" id="profileMenu"><button data-profile-settings>My profile</button><button id="signOut">Sign out</button></div></div></div></header>
      <main class="content" id="viewRoot"></main>
    </div><div class="mobile-scrim hidden" id="mobileScrim"></div>
    <div class="popover notifications-popover hidden" id="notificationsPopover"><header><strong>Notifications</strong><span>${notifications.length} open</span></header>${notifications.length ? notifications.slice(0, 8).map((item) => `<button data-notification="${item.id}"><i class="${item.type}"></i><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.help)}</small></span></button>`).join("") : '<p class="empty-copy">You are all caught up.</p>'}</div>
  </div>`;

  if (activeModule === "overview") renderOverview();
  else if (activeModule === "planner") renderPlanner();
  else renderSettings();
  bindShellEvents();
}

function bindShellEvents() {
  document.querySelector("#addTop").addEventListener("click", (event) => { event.stopPropagation(); document.querySelector("#createMenu").classList.toggle("hidden"); document.querySelector("#notificationsPopover").classList.add("hidden"); document.querySelector("#profileMenu").classList.add("hidden"); });
  document.querySelectorAll("[data-create]").forEach((button) => button.addEventListener("click", () => { document.querySelector("#createMenu").classList.add("hidden"); showActivityForm(null, selectedDate, { mode: button.dataset.create }); }));
  document.querySelectorAll("[data-module]").forEach((button) => button.addEventListener("click", () => { activeModule = button.dataset.module; closeMobileSidebar(); render(); }));
  document.querySelector("#sidebarToggle").addEventListener("click", () => { sidebarCollapsed = !sidebarCollapsed; render(); });
  document.querySelector("#mobileMenu").addEventListener("click", () => { document.querySelector("#sidebar").classList.add("mobile-open"); document.querySelector("#mobileScrim").classList.remove("hidden"); });
  document.querySelector("#mobileScrim").addEventListener("click", closeMobileSidebar);
  document.querySelector("#notificationButton").addEventListener("click", (event) => { event.stopPropagation(); document.querySelector("#notificationsPopover").classList.toggle("hidden"); document.querySelector("#profileMenu").classList.add("hidden"); document.querySelector("#createMenu").classList.add("hidden"); });
  document.querySelector("#profileButton").addEventListener("click", (event) => { event.stopPropagation(); document.querySelector("#profileMenu").classList.toggle("hidden"); document.querySelector("#notificationsPopover").classList.add("hidden"); document.querySelector("#createMenu").classList.add("hidden"); });
  document.querySelector("[data-profile-settings]").addEventListener("click", () => { activeModule = "settings"; settingsSection = "profile"; render(); });
  document.querySelector("#signOut").addEventListener("click", () => { localStorage.removeItem(SESSION_KEY); render(); });
  document.querySelectorAll("[data-notification]").forEach((button) => button.addEventListener("click", () => { document.querySelector("#notificationsPopover").classList.add("hidden"); showActivityDetail(button.dataset.notification); }));
}

function initials(name) { return String(name || "W").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function closeMobileSidebar() { document.querySelector("#sidebar")?.classList.remove("mobile-open"); document.querySelector("#mobileScrim")?.classList.add("hidden"); }
function notificationItems() {
  const items = [];
  for (const activity of state.activities) {
    if (state.settings.notificationFollowUps !== false && isFollowUpDue(activity)) items.push({ id: activity.id, title: activity.title, help: `Follow-up due ${niceDate(activity.followUpDate)}`, type: "followup" });
    else if (state.settings.notificationOverdue !== false && activity.date < today() && progress(activity) < 100) items.push({ id: activity.id, title: activity.title, help: `Overdue · planned for ${niceDate(activity.date)}`, type: "overdue" });
    else if (state.settings.notificationReviews !== false && activity.kind === "content" && activity.contentStatus === "In Review") items.push({ id: activity.id, title: activity.title, help: "Content is waiting for review", type: "review" });
    else if (state.settings.notificationPublishing !== false && activity.publicationTargets?.some((target) => target.status === "Approved" || target.status === "Scheduled")) items.push({ id: activity.id, title: activity.title, help: `${activity.publicationTargets.filter((target) => target.status === "Approved" || target.status === "Scheduled").length} publishing update${activity.publicationTargets.length === 1 ? "" : "s"}`, type: "publishing" });
  }
  return items.sort((a, b) => a.type.localeCompare(b.type));
}

function renderLogin() {
  app.innerHTML = `<section class="login-screen"><div class="login-brand-panel"><div class="login-brand">${momentumLockup()}<span class="brand-endorsement">by Webster</span></div><div class="login-promise"><span class="login-kicker">Business Development Command Centre</span><h1>Turn every opportunity into deliberate action.</h1><p>One connected workspace for planning, publishing, follow-ups and execution across Webster.</p><div class="login-proof"><span>✓ Eight growth verticals</span><span>✓ Connected weekly and monthly planning</span><span>✓ Private browser-based workspace</span></div></div><div class="login-footer"><strong>wave</strong> · Webster Actions, Visibility & Execution</div></div><div class="login-form-panel"><form class="login-card" id="loginForm"><div class="login-mobile-brand">${momentumLockup()}<span class="brand-endorsement">by Webster</span></div><span class="eyebrow">Private workspace</span><h2>Welcome back</h2><p>Sign in to continue to your command centre.</p><label class="field">Your name<input id="loginName" required value="${escapeHtml(state.profile.name)}" placeholder="Vishal Dudhal"/></label><label class="field">Work email<input id="loginEmail" type="email" value="${escapeHtml(state.profile.email)}" placeholder="you@webster.co.in"/></label><button class="button primary login-submit">Continue to wave →</button><small>Your planning data stays in this browser. No password or cloud account is required yet.</small></form></div></section>`;
  document.querySelector("#loginForm").addEventListener("submit", (event) => { event.preventDefault(); state.profile.name = document.querySelector("#loginName").value.trim() || DEFAULT_OWNER; state.profile.email = document.querySelector("#loginEmail").value.trim(); if (!state.team.includes(state.profile.name)) state.team.push(state.profile.name); save(); localStorage.setItem(SESSION_KEY, "active"); render(); });
}

function periodActivities(start, end) { return state.activities.filter((activity) => activity.date >= start && activity.date <= end); }
function completionRate(activities) { return activities.length ? Math.round(activities.reduce((sum, activity) => sum + progress(activity), 0) / activities.length) : 0; }
function progressRing(value, className = "", label = "Progress") {
  return `<span class="data-ring ${className}" role="img" aria-label="${label}: ${value}%"><svg viewBox="0 0 44 44"><circle class="ring-track" cx="22" cy="22" r="18"/><circle class="ring-value" cx="22" cy="22" r="18" pathLength="100" stroke-dasharray="${value} 100"/></svg><b>${value}%</b></span>`;
}

function renderOverview() {
  const current = today();
  const metrics = commandMetrics();
  const currentWeekStart = startOfWeek();
  const weekDates = Array.from({ length: 7 }, (_, index) => shiftDate(currentWeekStart, index));
  const week = periodActivities(currentWeekStart, endOfWeek(currentWeekStart));
  const month = periodActivities(firstOfMonth(), lastOfMonth(firstOfMonth()));
  const todayActivities = state.activities.filter((activity) => activity.date === current);
  const remainingToday = todayActivities.filter((activity) => progress(activity) < 100);
  const completedToday = todayActivities.filter((activity) => progress(activity) === 100);
  const dailyRate = completionRate(todayActivities);
  const focus = [...remainingToday].sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || progress(b) - progress(a)).slice(0, 5);
  const upcoming = state.activities.filter((activity) => activity.date > current && progress(activity) < 100).sort((a, b) => a.date.localeCompare(b.date) || PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)).slice(0, 4);
  const weekMomentum = weekDates.map((date) => { const items = state.activities.filter((activity) => activity.date === date); return { date, count: items.length, rate: completionRate(items) }; });
  const outcomes = [
    { label: "Outcomes recorded", value: month.filter((activity) => String(activity.outcome || "").trim()).length, icon: "overview" },
    { label: "Content published", value: month.filter((activity) => activity.publicationTargets?.some((target) => target.status === "Published")).length, icon: "arrowRight" },
    { label: "Follow-ups closed", value: month.filter((activity) => activity.followUpDone).length, icon: "activities" },
  ];
  const verticalStats = state.verticals.map((vertical) => { const items = month.filter((activity) => activity.vertical === vertical); return { vertical, count: items.length, rate: completionRate(items) }; }).filter((item) => item.count).sort((a, b) => b.count - a.count);
  const verticalTotal = verticalStats.reduce((sum, item) => sum + item.count, 0);
  document.querySelector("#viewRoot").innerHTML = `<section class="daily-snapshot surface"><div class="snapshot-heading"><span class="section-kicker">Daily snapshot</span><h2>${weekDay(current)}, ${niceDate(current)}</h2><p>Live progress across today’s plan.</p></div><div class="snapshot-progress">${progressRing(dailyRate, "snapshot-ring", "Today's progress")}<span><strong>Daily progress</strong><small>${todayActivities.length ? `${completedToday.length} of ${todayActivities.length} completed` : "No activities planned"}</small></span></div><div class="snapshot-metrics">${[["Planned",todayActivities.length,"calendar"],["Remaining",remainingToday.length,"remaining"],["Completed",completedToday.length,"completed"],["Follow-ups",metrics.followUps.length,"followups"]].map(([label,value,key]) => `<div class="snapshot-metric ${key}"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div></section>
    <section class="overview-primary"><article class="surface focus-panel"><header class="dashboard-panel-head"><div><span class="section-kicker">Today’s focus</span><h3>Priority activities</h3></div><button data-view-activities>All activities ${icon("arrowRight")}</button></header><div class="focus-list">${focus.length ? focus.map(overviewActivityRow).join("") : `<div class="focus-empty">${progressRing(100, "mini-ring", "Day complete")}<span><strong>Today is clear</strong><small>${todayActivities.length ? "Every planned activity is complete." : "No activities are scheduled for today."}</small></span></div>`}</div></article>
      <div class="overview-insights"><article class="surface momentum-panel"><header class="dashboard-panel-head"><div><span class="section-kicker">Weekly momentum</span><h3>${completionRate(week)}% average progress</h3></div><span>${week.length} planned</span></header><div class="momentum-chart">${weekMomentum.map((day) => `<div class="momentum-day ${day.date === current ? "current" : ""}" title="${niceDate(day.date)}: ${day.count} planned, ${day.rate}% progress"><strong>${day.count ? `${day.rate}%` : "—"}</strong><div><i style="--momentum:${day.rate}%"></i></div><span>${weekDay(day.date, true).slice(0, 2)}</span></div>`).join("")}</div></article>
        <article class="surface outcomes-panel"><header class="dashboard-panel-head"><div><span class="section-kicker">Business outcomes</span><h3>This month</h3></div></header><div class="outcome-grid">${outcomes.map((item) => `<div><span>${icon(item.icon)}</span><strong>${item.value}</strong><small>${item.label}</small></div>`).join("")}</div></article></div></section>
    <section class="overview-secondary"><article class="surface compact-upcoming"><header class="dashboard-panel-head"><div><span class="section-kicker">Next up</span><h3>Upcoming activities</h3></div><span>${upcoming.length} visible</span></header><div class="upcoming-compact">${upcoming.length ? upcoming.map((activity) => `<button data-activity="${activity.id}"><time><strong>${parseDate(activity.date).getDate()}</strong><span>${parseDate(activity.date).toLocaleDateString("en-IN", { month: "short" })}</span></time><span><strong>${escapeHtml(activity.title)}</strong><small>${escapeHtml(activity.owner)}</small></span>${icon("arrowRight")}</button>`).join("") : '<p class="compact-empty">No upcoming activities scheduled.</p>'}</div></article>
      <article class="surface vertical-balance"><header class="dashboard-panel-head"><div><span class="section-kicker">Vertical balance</span><h3>${verticalStats.length} active this month</h3></div></header>${verticalStats.length ? `<div class="vertical-stack">${verticalStats.map((item, index) => `<i class="tone-${index % 6}" style="width:${Math.max(2, Math.round(item.count / verticalTotal * 100))}%" title="${escapeHtml(item.vertical)}: ${item.count} activities, ${item.rate}% progress"></i>`).join("")}</div><div class="vertical-legend">${verticalStats.slice(0, 6).map((item, index) => `<span><i class="tone-${index % 6}"></i><b>${escapeHtml(item.vertical)}</b><small>${item.count} · ${item.rate}%</small></span>`).join("")}</div>` : '<p class="compact-empty">No activity planned this month.</p>'}</article></section>`;
  document.querySelectorAll("[data-view-activities]").forEach((button) => button.addEventListener("click", () => { activeModule = "planner"; viewMode = "activities"; render(); }));
  document.querySelectorAll("[data-activity]").forEach((button) => button.addEventListener("click", () => showActivityDetail(button.dataset.activity)));
}

function overviewActivityRow(activity) {
  const activityProgress = progress(activity);
  const completedSteps = activity.items.filter((item) => item.done).length;
  const stepCopy = activity.items.length ? `${completedSteps}/${activity.items.length} steps` : statusOf(activity);
  return `<button class="focus-row" data-activity="${activity.id}">${progressRing(activityProgress, "focus-ring", `${activity.title} progress`)}<span class="focus-copy"><strong><i class="priority-dot ${priorityClass(activity.priority)}"></i>${escapeHtml(activity.title)}</strong><small>${escapeHtml(activity.vertical)}<i></i>${stepCopy}</small></span><span class="focus-owner"><i>${escapeHtml(initials(activity.owner))}</i><small>${escapeHtml(activity.owner)}</small></span>${icon("arrowRight", "focus-arrow")}</button>`;
}
function emptyBlock(icon, title, copy) { return `<div class="module-empty"><i>${icon}</i><strong>${title}</strong><span>${copy}</span></div>`; }

function renderPlanner() {
  document.querySelector("#viewRoot").innerHTML = `<section class="module-toolbar planner-toolbar"><div class="view-switch"><button class="${viewMode === "week" ? "active" : ""}" data-view="week">Weekly Planner</button><button class="${viewMode === "month" ? "active" : ""}" data-view="month">Monthly Calendar</button><button class="${viewMode === "activities" ? "active" : ""}" data-view="activities">All Activities</button></div>${viewMode !== "activities" ? `<div class="planner-filters">${["All","Marketing","Business Development"].map((filter) => `<button class="${plannerFilter === filter ? "active" : ""}" data-planner-filter="${filter}">${filter}</button>`).join("")}</div><div class="filters"><label>Owner<select id="ownerFilter">${optionList(state.team, ownerFilter, true)}</select></label><label>Status<select id="statusFilter">${optionList(STATUSES, statusFilter, true)}</select></label></div>` : ""}</section><div id="plannerRoot"></div>`;
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { viewMode = button.dataset.view; render(); }));
  document.querySelectorAll("[data-planner-filter]").forEach((button) => button.addEventListener("click", () => { plannerFilter = button.dataset.plannerFilter; render(); }));
  document.querySelector("#ownerFilter")?.addEventListener("change", (event) => { ownerFilter = event.target.value; render(); });
  document.querySelector("#statusFilter")?.addEventListener("change", (event) => { statusFilter = event.target.value; render(); });
  if (viewMode === "month") renderMonthView(); else if (viewMode === "activities") renderActivities(); else renderWeekView();
}

function renderActivities() {
  const activities = filteredActivities().filter((activity) => !activitySearch || `${activity.title} ${activity.topic} ${activity.vertical} ${activity.owner}`.toLowerCase().includes(activitySearch.toLowerCase())).sort((a,b) => b.date.localeCompare(a.date));
  document.querySelector("#plannerRoot").innerHTML = `<section class="module-toolbar activity-toolbar"><label class="search-box">⌕<input id="activitySearch" placeholder="Search activities, owners or verticals" value="${escapeHtml(activitySearch)}"/></label><div class="filters"><label>Vertical<select id="verticalFilter">${optionList(state.verticals, verticalFilter, true)}</select></label><label>Status<select id="statusFilter">${optionList(STATUSES, statusFilter, true)}</select></label><label>Owner<select id="ownerFilter">${optionList(state.team, ownerFilter, true)}</select></label></div></section><section class="surface activity-manager"><header class="activity-table-head"><span>Activity</span><span>Type</span><span>Owner</span><span>Scheduled</span><span>Status</span><span>Progress</span></header><div class="activity-table-body">${activities.length ? activities.map((activity) => `<button class="activity-table-row" data-activity="${activity.id}"><span class="activity-name"><i class="priority-dot ${priorityClass(activity.priority)}"></i><span><strong>${escapeHtml(activity.title)}</strong><small>${escapeHtml(activity.topic || activity.platform || "No additional context")}</small></span></span><span data-label="Type"><i class="kind-pill ${activity.kind}">${activity.kind === "content" ? "Content" : escapeHtml(activity.vertical)}</i></span><span data-label="Owner"><i class="avatar-mini">${escapeHtml(initials(activity.owner))}</i>${escapeHtml(activity.owner)}</span><span data-label="Scheduled">${niceDate(activity.date, { year:"numeric" })}</span><span data-label="Status"><i class="status-pill ${statusClass(activity)}">${activity.kind === "content" ? escapeHtml(activity.contentStatus) : statusOf(activity)}</i></span><span data-label="Progress"><span class="table-progress"><i style="width:${progress(activity)}%"></i></span><b>${progress(activity)}%</b></span></button>`).join("") : emptyBlock("⌕", "No matching activities", "Adjust the search or filters.")}</div><footer class="table-footer"><span>${activities.length} activities</span><span>${activities.filter((item) => progress(item) === 100).length} completed</span></footer></section>`;
  document.querySelector("#activitySearch").addEventListener("input", (event) => { activitySearch = event.target.value; saveUiPreferences(); renderActivities(); });
  [["verticalFilter","verticalFilter"],["statusFilter","statusFilter"],["ownerFilter","ownerFilter"]].forEach(([id,key]) => document.querySelector(`#${id}`).addEventListener("change", (event) => { if (key === "verticalFilter") verticalFilter = event.target.value; if (key === "statusFilter") statusFilter = event.target.value; if (key === "ownerFilter") ownerFilter = event.target.value; saveUiPreferences(); renderActivities(); }));
  document.querySelectorAll("[data-activity]").forEach((button) => button.addEventListener("click", () => showActivityDetail(button.dataset.activity)));
}

function renderSettings() {
  const sections = [["profile","My Profile","◉"],["team","Team Members","♙"],["templates","Verticals & Templates","▦"],["preferences","Preferences","◫"],["notifications","Notifications","♢"],["integrations","Integrations","⌁"],["data","Data Management","↕"]];
  document.querySelector("#viewRoot").innerHTML = `<div class="settings-layout"><nav class="settings-nav" aria-label="Settings sections">${sections.map(([key,label,glyph]) => `<button class="${settingsSection === key ? "active" : ""}" data-settings-section="${key}"><i>${glyph}</i><span>${label}</span></button>`).join("")}</nav><section class="settings-content" id="settingsContent">${settingsSectionContent()}</section></div>`;
  document.querySelectorAll("[data-settings-section]").forEach((button) => button.addEventListener("click", () => { settingsSection = button.dataset.settingsSection; saveUiPreferences(); renderSettings(); }));
  bindSettingsEvents();
}

function settingsSectionContent() {
  const workingDays = [[1,"Mon"],[2,"Tue"],[3,"Wed"],[4,"Thu"],[5,"Fri"],[6,"Sat"],[0,"Sun"]];
  const heading = (title, copy) => `<header class="settings-page-head"><div><h2>${title}</h2><p>${copy}</p></div></header>`;
  if (settingsSection === "profile") return `${heading("My Profile", "Your identity across assignments, reviews and workspace activity.")}<section class="surface settings-panel"><form class="settings-form profile-settings-form" id="profileForm"><div class="profile-photo-field span-2"><span>${state.profile.avatar ? `<img src="${escapeHtml(state.profile.avatar)}" alt="Profile"/>` : escapeHtml(initials(state.profile.name))}</span><div><strong>Profile picture</strong><small>JPG or PNG, stored in this browser.</small><label class="button compact">Choose photo<input id="profileAvatar" type="file" accept="image/png,image/jpeg,image/webp"/></label>${state.profile.avatar ? '<button class="text-button" id="removeAvatar" type="button">Remove</button>' : ""}</div></div><label class="field">Name<input id="profileName" required value="${escapeHtml(state.profile.name)}"/></label><label class="field">Work email<input id="profileEmail" type="email" value="${escapeHtml(state.profile.email)}"/></label><label class="field span-2">Designation<input id="profileRole" value="${escapeHtml(state.profile.role)}"/></label><div class="form-actions span-2"><button class="button primary">Save profile</button></div></form></section>`;
  if (settingsSection === "team") return `${heading("Team Members", "Manage the people who can own activities and content.")}<section class="surface settings-panel"><div class="member-table"><header><span>Member</span><span>Designation</span><span>Date added</span><span>Status</span><span></span></header>${state.team.map((member) => { const detail = state.memberDetails?.[member] || {}; return `<div><span class="member-name"><i class="avatar-mini">${escapeHtml(initials(member))}</i><strong>${escapeHtml(member)}</strong></span><span>${escapeHtml(member === state.profile.name ? state.profile.role : detail.designation || "Team member")}</span><span>${niceDate((detail.dateAdded || new Date().toISOString()).slice(0,10), {year:"numeric"})}</span><span><i class="member-status">${escapeHtml(detail.status || "Active")}</i></span><span>${member !== state.profile.name ? `<button class="icon-danger" data-remove-team="${escapeHtml(member)}" aria-label="Remove ${escapeHtml(member)}">×</button>` : '<span class="you-tag">You</span>'}</span></div>`; }).join("")}</div><form class="inline-add member-add" id="teamForm"><input id="newTeamMember" required placeholder="Full name"/><input id="newTeamDesignation" placeholder="Designation"/><button class="button">Add member</button></form></section>`;
  if (settingsSection === "templates") {
    const tabs = [["verticals","Business Development Verticals"],["activity","Activity Templates"],["content","Content Templates"]];
    let body = "";
    if (settingsTemplateTab === "verticals") body = `<div class="template-grid">${state.verticals.map((vertical) => `<div><span><strong>${escapeHtml(vertical)}</strong><small>Business development vertical</small></span>${!Object.hasOwn(VERTICAL_TEMPLATES, vertical) ? `<button class="icon-danger" data-remove-vertical="${escapeHtml(vertical)}">×</button>` : ""}</div>`).join("")}</div><form class="inline-add" id="verticalForm"><input id="newVertical" required placeholder="Add a custom vertical"/><button class="button">Add vertical</button></form>`;
    if (settingsTemplateTab === "activity") body = `<div class="template-grid">${Object.entries(state.activityTemplates).map(([type,items]) => `<div><span><strong>${escapeHtml(type)}</strong><small>${items.length} default checklist steps</small></span><button class="button compact" data-edit-activity-template="${escapeHtml(type)}">Edit checklist</button></div>`).join("")}</div>`;
    if (settingsTemplateTab === "content") body = `<div class="template-grid">${Object.entries(state.contentTemplates).map(([format,items]) => `<div><span><strong>${escapeHtml(format)}</strong><small>${items.length} production steps</small></span><button class="button compact" data-edit-content-template="${escapeHtml(format)}">Edit checklist</button></div>`).join("")}</div>`;
    return `${heading("Verticals & Templates", "Customize planning defaults without changing existing records.")}<section class="surface settings-panel"><div class="settings-tabs">${tabs.map(([key,label]) => `<button class="${settingsTemplateTab === key ? "active" : ""}" data-template-tab="${key}">${label}</button>`).join("")}</div>${body}</section>`;
  }
  if (settingsSection === "preferences") return `${heading("Preferences", "Set the rules WAVE uses when planning and rescheduling work.")}<section class="surface settings-panel settings-stack"><div><h3>Working days</h3><p>Automatic rescheduling only uses enabled days.</p><div class="day-toggles">${workingDays.map(([value,label]) => `<label><input type="checkbox" data-working-day value="${value}" ${state.settings.workingDays.includes(value) ? "checked" : ""}/><span>${label}</span></label>`).join("")}</div></div><div><h3>Holidays</h3><div class="holiday-list">${state.settings.holidays.length ? state.settings.holidays.map((date) => `<span>${niceDate(date,{year:"numeric"})}<button data-remove-holiday="${date}">×</button></span>`).join("") : '<p class="empty-copy">No holidays added.</p>'}</div><form class="inline-add" id="holidayForm"><input id="holidayDate" type="date" required/><button class="button">Add holiday</button></form></div><div class="preference-grid"><label class="field">Default planner view<select id="defaultPlannerView"><option value="week" ${state.settings.defaultPlannerView === "week" ? "selected" : ""}>Weekly Planner</option><option value="month" ${state.settings.defaultPlannerView === "month" ? "selected" : ""}>Monthly Calendar</option><option value="activities" ${state.settings.defaultPlannerView === "activities" ? "selected" : ""}>All Activities</option></select></label><label class="field">Timezone<select id="timezone"><option>Asia/Kolkata</option><option>UTC</option><option>Europe/London</option><option>America/New_York</option></select></label></div><label class="settings-toggle"><span><strong>Automatic rescheduling</strong><small>Carry unfinished flexible activities to the next working day.</small></span><input id="autoReschedule" type="checkbox" ${state.settings.autoReschedule !== false ? "checked" : ""}/><i></i></label></section>`;
  if (settingsSection === "notifications") return `${heading("Notifications", "Choose which updates should appear in WAVE.")}<section class="surface settings-panel settings-stack"><label class="settings-toggle"><span><strong>Daily briefing</strong><small>Show an independent planning popup at the selected time.</small></span><input id="reminderEnabled" type="checkbox" ${state.settings.reminderEnabled ? "checked" : ""}/><i></i></label><label class="field notification-time">Daily briefing time<input id="reminderTime" type="time" value="${state.settings.reminderTime}"/></label>${[["notificationFollowUps","Follow-up reminders","Activities with a follow-up due."],["notificationOverdue","Overdue activities","Incomplete work past its planned date."],["notificationReviews","Pending reviews","Content waiting in the review stage."],["notificationPublishing","Publishing updates","Approved or scheduled channel updates."]].map(([key,title,copy]) => `<label class="settings-toggle"><span><strong>${title}</strong><small>${copy}</small></span><input data-notification-setting="${key}" type="checkbox" ${state.settings[key] !== false ? "checked" : ""}/><i></i></label>`).join("")}</section>`;
  if (settingsSection === "integrations") return `${heading("Integrations", "Connection surfaces are prepared for future product integrations.")}<div class="integration-grid">${[["Google Calendar","Two-way event and activity sync","G"],["Social platforms","Publishing and performance updates","#"],["Website CMS","Blog drafts and website publishing","W"],["Cloud storage","Shared files and creative assets","☁"],["AI tools","Assisted briefs, drafts and summaries","✦"],["Automation connectors","Triggers and cross-app workflows","⌁"]].map(([name,copy,glyph]) => `<article class="surface integration-card"><i>${glyph}</i><div><h3>${name}</h3><p>${copy}</p></div><span>Planned</span></article>`).join("")}</div><p class="integration-note">No connection is active. WAVE will only show connected services after real authorization and verification are implemented.</p>`;
  return `${heading("Data Management", "Protect, restore, or replace the local workspace plan.")}<section class="surface settings-panel data-settings"><div class="data-facts"><span><strong>${state.activities.length}</strong> activities</span><span><strong>${state.recurrences.length}</strong> recurring schedules</span><span><strong>${state.team.length}</strong> team members</span></div><div class="data-row"><div><h3>Backup & restore</h3><p>Download a portable workspace copy or restore a previous WAVE backup.</p></div><button class="button primary" id="openDataTools">Open backup tools</button></div><div class="data-row"><div><h3>Demo workspace</h3><p>Replace activities with a realistic sample plan. Profile and preferences are preserved.</p></div><button class="button" id="loadDemoData">Load demo data</button></div></section>`;
}

function bindSettingsEvents() {
  document.querySelector("#profileForm")?.addEventListener("submit", (event) => { event.preventDefault(); const previous = state.profile.name; state.profile = { ...state.profile, name: document.querySelector("#profileName").value.trim() || DEFAULT_OWNER, email: document.querySelector("#profileEmail").value.trim(), role: document.querySelector("#profileRole").value.trim() || "Business Development" }; if (!state.team.includes(state.profile.name)) state.team.push(state.profile.name); if (previous !== state.profile.name) state.team = state.team.filter((name) => name !== previous || state.activities.some((activity) => activity.owner === previous)); save(); render(); });
  document.querySelector("#profileAvatar")?.addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file || file.size > 1_500_000) return file && window.alert("Profile pictures must be smaller than 1.5 MB."); state.profile.avatar = (await readFile(file)).data; save(); render(); });
  document.querySelector("#removeAvatar")?.addEventListener("click", () => { state.profile.avatar = ""; save(); render(); });
  document.querySelector("#teamForm")?.addEventListener("submit", (event) => { event.preventDefault(); const value = document.querySelector("#newTeamMember").value.trim(); if (value && !state.team.includes(value)) { state.team.push(value); state.memberDetails[value] = { designation: document.querySelector("#newTeamDesignation").value.trim(), dateAdded: new Date().toISOString(), status: "Active" }; } save(); renderSettings(); });
  document.querySelectorAll("[data-remove-team]").forEach((button) => button.addEventListener("click", () => { const member = button.dataset.removeTeam; if (state.activities.some((activity) => activity.owner === member)) return window.alert("Reassign this person’s activities before removing them."); state.team = state.team.filter((item) => item !== member); save(); render(); }));
  document.querySelector("#verticalForm")?.addEventListener("submit", (event) => { event.preventDefault(); const value = document.querySelector("#newVertical").value.trim(); if (value && !state.verticals.includes(value)) { state.verticals.push(value); state.templates[value] = []; } save(); renderSettings(); });
  document.querySelectorAll("[data-remove-vertical]").forEach((button) => button.addEventListener("click", () => { const vertical = button.dataset.removeVertical; if (state.activities.some((activity) => activity.vertical === vertical)) return window.alert("Move this vertical’s activities before removing it."); state.verticals = state.verticals.filter((item) => item !== vertical); delete state.templates[vertical]; save(); render(); }));
  document.querySelectorAll("[data-edit-template]").forEach((button) => button.addEventListener("click", () => showTemplateEditor(button.dataset.editTemplate)));
  document.querySelectorAll("[data-edit-activity-template]").forEach((button) => button.addEventListener("click", () => showTemplateEditor(button.dataset.editActivityTemplate, "activity")));
  document.querySelectorAll("[data-edit-content-template]").forEach((button) => button.addEventListener("click", () => showTemplateEditor(button.dataset.editContentTemplate, "content")));
  document.querySelectorAll("[data-template-tab]").forEach((button) => button.addEventListener("click", () => { settingsTemplateTab = button.dataset.templateTab; renderSettings(); }));
  document.querySelectorAll("[data-working-day]").forEach((input) => input.addEventListener("change", () => { const values = [...document.querySelectorAll("[data-working-day]:checked")].map((item) => Number(item.value)); if (!values.length) { input.checked = true; return window.alert("Keep at least one working day."); } state.settings.workingDays = values; save(); }));
  document.querySelector("#holidayForm")?.addEventListener("submit", (event) => { event.preventDefault(); const value = document.querySelector("#holidayDate").value; if (value && !state.settings.holidays.includes(value)) state.settings.holidays.push(value); state.settings.holidays.sort(); save(); renderSettings(); });
  document.querySelectorAll("[data-remove-holiday]").forEach((button) => button.addEventListener("click", () => { state.settings.holidays = state.settings.holidays.filter((date) => date !== button.dataset.removeHoliday); save(); render(); }));
  document.querySelector("#reminderEnabled")?.addEventListener("change", (event) => { state.settings.reminderEnabled = event.target.checked; save(); });
  document.querySelector("#reminderTime")?.addEventListener("change", (event) => { state.settings.reminderTime = event.target.value || "10:00"; save(); });
  document.querySelector("#defaultPlannerView")?.addEventListener("change", (event) => { state.settings.defaultPlannerView = event.target.value; viewMode = event.target.value; save(); saveUiPreferences(); });
  document.querySelector("#timezone")?.addEventListener("change", (event) => { state.settings.timezone = event.target.value; save(); });
  document.querySelector("#autoReschedule")?.addEventListener("change", (event) => { state.settings.autoReschedule = event.target.checked; save(); });
  document.querySelectorAll("[data-notification-setting]").forEach((input) => input.addEventListener("change", () => { state.settings[input.dataset.notificationSetting] = input.checked; save(); }));
  document.querySelector("#loadDemoData")?.addEventListener("click", () => {
    if (!window.confirm("Replace the current activity plan with the WAVE demo workspace? Download a backup first if you need the current activities.")) return;
    loadDemoData(); ownerFilter = "All"; verticalFilter = "All"; statusFilter = "All"; plannerFilter = "All"; activitySearch = ""; selectedDate = today(); monthStart = firstOfMonth(); weekStart = startOfWeek(); activeModule = "overview"; render();
  });
  document.querySelector("#openDataTools")?.addEventListener("click", showDataTools);
}

function showTemplateEditor(template, kind = "vertical") {
  const collection = kind === "content" ? state.contentTemplates : kind === "activity" ? state.activityTemplates : state.templates;
  const items = collection[template] || [];
  openModal(`<article class="modal"><header class="modal-head"><div><div class="eyebrow">${kind === "content" ? "Content" : "Activity"} template</div><h2>${escapeHtml(template)}</h2><p class="modal-description">Enter one default checklist step per line.</p></div><button class="close-button" data-close>×</button></header><form id="templateForm"><label class="field template-field">Checklist steps<textarea id="templateSteps" rows="10">${escapeHtml(items.join("\n"))}</textarea></label><div class="form-actions"><button class="button" type="button" data-close>Cancel</button><button class="button primary">Save template</button></div></form></article>`);
  overlay.querySelector("#templateForm").addEventListener("submit", (event) => { event.preventDefault(); collection[template] = overlay.querySelector("#templateSteps").value.split("\n").map((item) => item.trim()).filter(Boolean); save(); closeModal(); render(); });
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
  openModal(`<aside class="activity-drawer" role="dialog" aria-modal="true"><header class="drawer-head"><div><div class="eyebrow">${activity.kind === "content" ? "Content" : escapeHtml(activity.vertical)}</div><h2>${escapeHtml(activity.title)}</h2></div><button class="close-button" data-close>×</button></header><div class="drawer-badges"><span class="priority-badge ${priorityClass(activity.priority)}">${escapeHtml(activity.priority)} priority</span><span class="status-pill ${statusClass(activity)}">${activity.kind === "content" ? escapeHtml(activity.contentStatus) : statusOf(activity)}</span>${schedule ? `<span class="recurrence-tag">↻ ${escapeHtml(schedule.frequency)}</span>` : ""}${isCarried(activity) ? '<span class="carried-tag">↗ Carried forward</span>' : ""}</div>
    <div class="detail-grid"><div><span>${activity.kind === "content" ? "Publishing" : "Scheduled"}</span><strong>${niceDate(activity.date, { year: "numeric" })}</strong></div><div><span>Assigned</span><strong>${escapeHtml(activity.owner)}</strong></div><div><span>${activity.kind === "content" ? "Format" : "Platform / context"}</span><strong>${escapeHtml(activity.kind === "content" ? activity.contentFormat || activity.activityType || "Not set" : activity.platform || "Not set")}</strong></div><div><span>${activity.kind === "content" ? "Lifecycle" : "Activity type"}</span><strong>${escapeHtml(activity.kind === "content" ? activity.contentStatus : activity.activityType || "Not set")}</strong></div><div><span>Category</span><strong>${escapeHtml(activity.category || "Not set")}</strong></div><div><span>Follow-up</span><strong>${activity.followUpDate ? niceDate(activity.followUpDate, { year: "numeric" }) : "Not set"}</strong></div></div>
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
          ownerFilter = "All"; verticalFilter = "All"; statusFilter = "All"; plannerFilter = "All"; activitySearch = "";
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
  const formMode = activity?.kind || context.mode || (context.type === "channel" ? "content" : "activity");
  const isContent = formMode === "content";
  const initialVertical = isContent ? "Marketing" : activity?.vertical || (context.type === "vertical" ? context.row : state.verticals.find((item) => item !== "Marketing") || state.verticals[0]);
  const initialActivityType = activity?.activityType || Object.keys(state.activityTemplates)[0];
  const inferredContentFormat = activity?.activityType === "Article" ? "Blog" : activity?.activityType === "Video" ? "Video" : activity?.activityType === "Reel / Short" ? "Reel" : "Social post";
  const initialContentFormat = activity?.contentFormat || inferredContentFormat;
  const activityTypes = Array.from(new Set([...Object.keys(state.activityTemplates), ...(activity?.activityType ? [activity.activityType] : [])]));
  const initialTemplate = isContent ? state.contentTemplates[initialContentFormat] : state.activityTemplates[initialActivityType];
  let draftItems = activity ? activity.items.map((item) => ({ ...item })) : (initialTemplate || state.templates[initialVertical] || []).map((label) => ({ id: uid(), label, done: false }));
  let draftAttachments = activity ? activity.attachments.map((file) => ({ ...file })) : [];
  let draftTargets = activity ? activity.publicationTargets.map((target) => ({ ...target })) : (context.type === "channel" ? [{ channel: context.row, status: "Planned" }] : []);
  const recurrenceFrequency = schedule?.frequency || "none";
  const recurringWeekdays = schedule?.weekdays || [];
  openModal(`<article class="modal form-modal wide-form contextual-form" role="dialog" aria-modal="true"><header class="modal-head"><div><div class="eyebrow">${editing ? `Edit ${isContent ? "content" : "activity"}` : "New plan"}</div><h2>${editing ? `Update ${isContent ? "content" : "activity"}` : isContent ? "Plan Content" : "Plan an Activity"}</h2><p class="modal-description">${isContent ? "Create once, move through review, and track every publishing channel." : "Plan a clear business development action with only the fields you need."}</p></div><button class="close-button" data-close>×</button></header>
    <form class="form activity-form" id="activityForm">
      <label class="field span-2">${isContent ? "Content title" : "Activity title"}<input id="activityTitle" required maxlength="120" placeholder="${isContent ? "What are you creating?" : "What needs to happen?"}" value="${escapeHtml(activity?.title || "")}"/></label>
      ${isContent ? '<select id="activityVertical" class="hidden"><option>Marketing</option></select><input id="activityVerticalNew" class="hidden"/>' : fieldSelect("Business development vertical", "activityVertical", state.verticals, initialVertical, "Add new vertical…")}
      ${fieldSelect("Assigned person", "activityOwner", state.team, activity?.owner || DEFAULT_OWNER, "Add new person…")}
      <label class="field">${isContent ? "Publishing date" : "Scheduled date"}<input id="activityDate" type="date" required value="${activity?.date || defaultDate}"/></label>
      <label class="field">Priority<select id="activityPriority">${PRIORITIES.map((priority) => `<option ${activity?.priority === priority || (!activity && priority === "Medium") ? "selected" : ""}>${priority}</option>`).join("")}</select></label>
      ${isContent ? `<label class="field">Content format<select id="contentFormat">${CONTENT_FORMATS.map((format) => `<option ${initialContentFormat === format ? "selected" : ""}>${format}</option>`).join("")}</select></label><label class="field">Content lifecycle<select id="contentStatus">${PUBLISHING_STATUSES.map((status) => `<option ${activity?.contentStatus === status || (!activity && status === "Planned") ? "selected" : ""}>${status}</option>`).join("")}</select></label><input id="activityType" class="hidden" value="${escapeHtml(initialContentFormat)}"/><input id="activityPlatform" class="hidden" value="${escapeHtml(activity?.platform || "")}"/>` : `<label class="field">Activity type<select id="activityType">${activityTypes.map((type) => `<option ${initialActivityType === type ? "selected" : ""}>${type}</option>`).join("")}</select></label><label class="field" id="activityContextLabel">Contact, platform or location<input id="activityPlatform" list="platformSuggestions" maxlength="60" placeholder="Where or with whom?" value="${escapeHtml(activity?.platform || "")}"/><datalist id="platformSuggestions">${PLATFORM_SUGGESTIONS.map((value) => `<option value="${value}">`).join("")}</datalist></label><input id="contentFormat" class="hidden" value=""/><input id="contentStatus" class="hidden" value="Planned"/>`}
      <label class="field">Category<input id="activityCategory" list="categorySuggestions" maxlength="60" placeholder="${isContent ? "e.g. Awareness" : "e.g. Lead generation"}" value="${escapeHtml(activity?.category || "")}"/><datalist id="categorySuggestions">${CATEGORY_SUGGESTIONS.map((value) => `<option value="${value}">`).join("")}</datalist></label>
      <label class="field">${isContent ? "Topic" : "Purpose or topic"}<input id="activityTopic" maxlength="120" placeholder="${isContent ? "Campaign or content topic" : "What is this activity about?"}" value="${escapeHtml(activity?.topic || "")}"/></label>
      <section class="form-section span-2 ${isContent ? "" : "hidden"}" id="publishingSection"><div class="section-title"><h3>Publishing channels</h3><span>Individual status per channel</span></div><div class="publishing-editor" id="publishingEditor"></div><label class="field blog-type-field ${activity?.blogType || context.row === "Blogs" ? "" : "hidden"}" id="blogTypeField">Blog stream<select id="blogType"><option value="">Choose blog stream</option>${BLOG_TYPES.map((type) => `<option ${activity?.blogType === type ? "selected" : ""}>${type}</option>`).join("")}</select></label></section>
      <section class="form-section span-2 production-checklist"><div class="section-title checklist-heading"><div><h3>${isContent ? "Production checklist" : "Activity checklist"}</h3><small>Loaded from your ${isContent ? "content format" : "activity type"} template</small></div><span id="stepCount"></span></div><div id="checklistEditor"></div><button class="new-check" id="addChecklistItem" type="button">＋ Add checklist step</button></section>
      <details class="additional-details span-2" ${editing && (activity.additionalDetails || activity.notes || activity.resources || activity.outcome || activity.followUpDate || activity.attachments.length || schedule) ? "open" : ""}><summary><span><strong>Additional Details</strong><small>Recurrence, follow-ups, notes, outcomes and resources</small></span><i>⌄</i></summary><div class="additional-details-grid">
      <label class="field span-2">Brief or instructions<textarea id="additionalDetails" rows="3" placeholder="Brief, talking points or instructions">${escapeHtml(activity?.additionalDetails || "")}</textarea></label>
      <label class="field">Follow-up date<input id="followUpDate" type="date" value="${activity?.followUpDate || ""}"/></label>
      <label class="inline-check fixed-field"><input id="fixedDate" type="checkbox" ${activity?.fixed ? "checked" : ""}/><span><strong>Fixed date</strong><small>Never move automatically</small></span></label>
      <section class="form-section span-2"><div class="section-title"><h3>Recurrence</h3><span>Fresh checklist for every occurrence</span></div><div class="recurrence-grid"><label class="field">Repeat<select id="recurrenceFrequency"><option value="none" ${recurrenceFrequency === "none" ? "selected" : ""}>Does not repeat</option><option value="weekly" ${recurrenceFrequency === "weekly" ? "selected" : ""}>Weekly</option><option value="monthly" ${recurrenceFrequency === "monthly" ? "selected" : ""}>Monthly</option><option value="weekdays" ${recurrenceFrequency === "weekdays" ? "selected" : ""}>Specific weekdays</option></select></label><label class="field">End date (optional)<input id="recurrenceUntil" type="date" value="${schedule?.until || ""}"/></label>${schedule ? `<label class="field">Apply changes<select id="editScope"><option value="occurrence">This occurrence only</option><option value="series">This and future schedule</option></select></label>` : ""}</div><div class="weekday-picker ${recurrenceFrequency === "weekdays" ? "" : "hidden"}" id="weekdayPicker">${[[1,"Mon"],[2,"Tue"],[3,"Wed"],[4,"Thu"],[5,"Fri"],[6,"Sat"],[0,"Sun"]].map(([value,label]) => `<label><input type="checkbox" value="${value}" ${recurringWeekdays.includes(value) ? "checked" : ""}/><span>${label}</span></label>`).join("")}</div></section>
      <label class="field span-2">Notes<textarea id="activityNotes" rows="3" placeholder="Internal context and working notes">${escapeHtml(activity?.notes || "")}</textarea></label>
      <label class="field span-2">Outcome<textarea id="activityOutcome" rows="2" placeholder="Result, response or next decision">${escapeHtml(activity?.outcome || "")}</textarea></label>
      <label class="field span-2">Resource links<textarea id="activityResources" rows="2" placeholder="One link or reference per line">${escapeHtml(activity?.resources || "")}</textarea></label>
      <section class="form-section span-2"><div class="section-title"><h3>Attachments</h3><span>Stored locally · 1.5 MB each / 3 MB total</span></div><label class="file-input">＋ Add files<input id="attachmentInput" type="file" multiple/></label><div id="attachmentEditor"></div><p class="form-error hidden" id="attachmentError"></p></section>
      </div></details>
      <div class="form-actions span-2"><button class="button" type="button" data-close>Cancel</button><button class="button primary" type="submit">${editing ? "Save changes" : isContent ? "Plan content" : "Plan activity"}</button></div>
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
  const getVertical = isContent ? () => "Marketing" : setupCustomSelect(verticalSelect);
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
    publishingEditor.querySelectorAll("[data-publish-channel]").forEach((input) => input.addEventListener("change", () => { if (input.checked) draftTargets.push({ channel: input.dataset.publishChannel, status: "Planned" }); else draftTargets = draftTargets.filter((item) => item.channel !== input.dataset.publishChannel); drawPublishing(); }));
    publishingEditor.querySelectorAll("[data-publish-select]").forEach((select) => select.addEventListener("change", () => { const target = draftTargets.find((item) => item.channel === select.dataset.publishSelect); if (target) target.status = select.value; }));
    overlay.querySelector("#blogTypeField").classList.toggle("hidden", !draftTargets.some((item) => item.channel === "Blogs"));
  }
  drawChecklist(); drawAttachments(); drawPublishing();
  const templateSelector = overlay.querySelector(isContent ? "#contentFormat" : "#activityType");
  templateSelector.addEventListener("change", () => { const template = isContent ? state.contentTemplates[templateSelector.value] : state.activityTemplates[templateSelector.value]; if (template && (!draftItems.length || !editing || window.confirm("Replace the current checklist with this template?"))) { draftItems = template.map((label) => ({ id: uid(), label, done: false })); drawChecklist(); } if (isContent) overlay.querySelector("#activityType").value = templateSelector.value; });
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
      title: overlay.querySelector("#activityTitle").value.trim(), vertical, owner, kind: formMode,
      date: overlay.querySelector("#activityDate").value, priority: overlay.querySelector("#activityPriority").value,
      platform: overlay.querySelector("#activityPlatform").value.trim(), activityType: overlay.querySelector("#activityType").value.trim(),
      contentFormat: overlay.querySelector("#contentFormat").value, contentStatus: overlay.querySelector("#contentStatus").value,
      category: overlay.querySelector("#activityCategory").value.trim(), blogType: overlay.querySelector("#blogType").value, topic: overlay.querySelector("#activityTopic").value.trim(),
      additionalDetails: overlay.querySelector("#additionalDetails").value.trim(), notes: overlay.querySelector("#activityNotes").value.trim(),
      outcome: overlay.querySelector("#activityOutcome").value.trim(), resources: overlay.querySelector("#activityResources").value.trim(),
      followUpDate: overlay.querySelector("#followUpDate").value, fixed: overlay.querySelector("#fixedDate").checked,
      attachments: draftAttachments, publicationTargets: isContent ? draftTargets : [], items: draftItems.filter((item) => item.label.trim()).map((item) => ({ ...item, label: item.label.trim() })),
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
