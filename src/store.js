import { DEFAULT_OWNER, DEFAULT_VERTICALS, MAX_DAILY_OPEN, PRIORITIES, STORAGE_KEY, VERTICAL_TEMPLATES } from "./config.js";
import { dateRange, firstOfMonth, isWorkday, lastOfMonth, nextWorkday, parseDate, shiftDate, shiftMonth, today, toLocalDate, weekdayNumber } from "./dates.js";

export const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
export const progress = (activity) => activity.items.length ? Math.round((activity.items.filter((item) => item.done).length / activity.items.length) * 100) : activity.manualDone ? 100 : 0;
export const statusOf = (activity) => progress(activity) === 100 ? "Completed" : progress(activity) ? "In progress" : "Scheduled";
export const isFollowUpDue = (activity) => activity.followUpDate && activity.followUpDate <= today() && !activity.followUpDone;

const cleanText = (value) => String(value || "").trim();
const normalizeItem = (item) => ({ id: item?.id || uid(), label: cleanText(item?.label) || "Checklist item", done: Boolean(item?.done) });
const normalizeAttachment = (file) => ({ id: file?.id || uid(), name: cleanText(file?.name) || "Attachment", type: cleanText(file?.type), size: Number(file?.size || 0), data: String(file?.data || "") });

export function normalizeActivity(activity = {}) {
  const date = activity.date || today();
  return {
    ...activity,
    id: activity.id || uid(),
    title: cleanText(activity.title) || "Untitled activity",
    vertical: cleanText(activity.vertical) || "Marketing",
    date,
    originalDate: activity.originalDate || date,
    owner: cleanText(activity.owner) || DEFAULT_OWNER,
    priority: PRIORITIES.includes(activity.priority) ? activity.priority : "Medium",
    platform: cleanText(activity.platform),
    activityType: cleanText(activity.activityType),
    category: cleanText(activity.category),
    topic: cleanText(activity.topic),
    additionalDetails: cleanText(activity.additionalDetails),
    notes: String(activity.notes || ""),
    resources: String(activity.resources || ""),
    outcome: String(activity.outcome || ""),
    followUpDate: activity.followUpDate || "",
    followUpDone: Boolean(activity.followUpDone),
    fixed: Boolean(activity.fixed),
    manualDone: Boolean(activity.manualDone),
    items: Array.isArray(activity.items) ? activity.items.map(normalizeItem) : [],
    attachments: Array.isArray(activity.attachments) ? activity.attachments.map(normalizeAttachment) : [],
    history: Array.isArray(activity.history) ? activity.history : [],
    recurrenceId: activity.recurrenceId || "",
    occurrenceDate: activity.occurrenceDate || (activity.recurrenceId ? date : ""),
    createdAt: activity.createdAt || new Date().toISOString(),
    updatedAt: activity.updatedAt || new Date().toISOString(),
  };
}

function normalizeSchedule(schedule = {}) {
  return {
    id: schedule.id || uid(),
    frequency: ["weekly", "monthly", "weekdays"].includes(schedule.frequency) ? schedule.frequency : "weekly",
    startDate: schedule.startDate || today(),
    until: schedule.until || "",
    weekdays: Array.isArray(schedule.weekdays) ? schedule.weekdays.map(Number).filter((day) => day >= 0 && day <= 6) : [],
    template: { ...(schedule.template || {}) },
    createdAt: schedule.createdAt || new Date().toISOString(),
    updatedAt: schedule.updatedAt || new Date().toISOString(),
  };
}

function templateFrom(activity) {
  return {
    title: activity.title, vertical: activity.vertical, owner: activity.owner, priority: activity.priority,
    platform: activity.platform, activityType: activity.activityType, category: activity.category,
    topic: activity.topic, additionalDetails: activity.additionalDetails, notes: activity.notes,
    resources: activity.resources, outcome: "", followUpDate: "", followUpDone: false,
    fixed: activity.fixed, attachments: activity.attachments,
    checklist: activity.items.map((item) => item.label),
  };
}

function createExamples() {
  const base = today();
  const create = (offset, title, vertical, completed = 0, priority = "Medium", platform = "") => normalizeActivity({
    title, vertical, priority, platform, owner: DEFAULT_OWNER, date: shiftDate(base, offset), originalDate: shiftDate(base, offset),
    items: VERTICAL_TEMPLATES[vertical].map((label, index) => ({ label, done: index < completed })),
  });
  return [
    create(0, "Plan this week’s LinkedIn insight", "Marketing", 2, "Medium", "LinkedIn"),
    create(0, "Reach out to five potential clients", "Direct Outreach", 1, "High", "LinkedIn"),
    create(1, "Reconnect with two former clients", "Past Client Development", 0, "High", "Email"),
    create(3, "Review new business enquiries", "Inbound", 0, "High", "Website"),
    create(5, "Explore an agency collaboration", "Partnerships", 0, "Medium", "Meeting"),
  ];
}

function readState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.activities)) {
      const activities = stored.activities.map(normalizeActivity);
      return {
        ...stored,
        schemaVersion: 3,
        activities,
        recurrences: Array.isArray(stored.recurrences) ? stored.recurrences.map(normalizeSchedule) : [],
        team: Array.from(new Set([DEFAULT_OWNER, ...(stored.team || []), ...activities.map((item) => item.owner).filter(Boolean)])),
        verticals: Array.from(new Set([...DEFAULT_VERTICALS, ...(stored.verticals || []), ...activities.map((item) => item.vertical).filter(Boolean)])),
      };
    }
  } catch { /* Fall through to starter data. */ }
  return { schemaVersion: 3, activities: createExamples(), recurrences: [], team: [DEFAULT_OWNER], verticals: [...DEFAULT_VERTICALS] };
}

export const state = readState();
export function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function normalizedState(source) {
  if (!source || typeof source !== "object" || !Array.isArray(source.activities)) throw new Error("This file does not contain a valid WAVE plan.");
  if (Number(source.schemaVersion || 1) > 3) throw new Error("This backup was created by a newer version of WAVE.");
  if (source.recurrences != null && !Array.isArray(source.recurrences)) throw new Error("The recurring schedule data is invalid.");
  const activities = source.activities.map(normalizeActivity);
  return {
    schemaVersion: 3,
    activities,
    recurrences: (source.recurrences || []).map(normalizeSchedule),
    team: Array.from(new Set([DEFAULT_OWNER, ...(Array.isArray(source.team) ? source.team : []), ...activities.map((item) => item.owner).filter(Boolean)])),
    verticals: Array.from(new Set([...DEFAULT_VERTICALS, ...(Array.isArray(source.verticals) ? source.verticals : []), ...activities.map((item) => item.vertical).filter(Boolean)])),
  };
}

export function createBackup() {
  return {
    format: "webster-wave-backup",
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: "0.4.0",
    data: JSON.parse(JSON.stringify(state)),
  };
}

export function restoreBackup(backup) {
  const source = backup?.format === "webster-wave-backup" ? backup.data : backup;
  const restored = normalizedState(source);
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, restored);
  save();
  return { activities: state.activities.length, recurrences: state.recurrences.length };
}

function occurrenceDates(schedule, throughDate) {
  const end = schedule.until && schedule.until < throughDate ? schedule.until : throughDate;
  if (schedule.startDate > end) return [];
  if (schedule.frequency === "weekly") {
    const dates = [];
    for (let date = schedule.startDate; date <= end; date = shiftDate(date, 7)) dates.push(date);
    return dates;
  }
  if (schedule.frequency === "monthly") {
    const dates = [];
    const wantedDay = parseDate(schedule.startDate).getDate();
    for (let cursor = firstOfMonth(schedule.startDate); cursor <= end; cursor = shiftMonth(cursor, 1)) {
      const month = parseDate(cursor);
      const lastValidDay = parseDate(lastOfMonth(cursor)).getDate();
      const candidate = new Date(month.getFullYear(), month.getMonth(), Math.min(wantedDay, lastValidDay), 12);
      const value = toLocalDate(candidate);
      if (value >= schedule.startDate && value <= end) dates.push(value);
    }
    return dates;
  }
  const weekdays = schedule.weekdays.length ? schedule.weekdays : [weekdayNumber(schedule.startDate)];
  return dateRange(schedule.startDate, end).filter((date) => weekdays.includes(weekdayNumber(date)));
}

function occurrenceFrom(schedule, date) {
  const template = schedule.template;
  return normalizeActivity({
    ...template,
    id: uid(), date, originalDate: date, recurrenceId: schedule.id, occurrenceDate: date,
    followUpDate: "", followUpDone: false, manualDone: false, history: [],
    items: (template.checklist || []).map((label) => ({ id: uid(), label, done: false })),
  });
}

export function syncRecurrences(throughDate = lastOfMonth(shiftMonth(firstOfMonth(), 2))) {
  let changed = false;
  for (const schedule of state.recurrences) {
    for (const date of occurrenceDates(schedule, throughDate)) {
      const exists = state.activities.some((activity) => activity.recurrenceId === schedule.id && activity.occurrenceDate === date);
      if (!exists) { state.activities.push(occurrenceFrom(schedule, date)); changed = true; }
    }
  }
  if (changed) save();
  return changed;
}

function nextAvailableWorkingDay(activity) {
  let candidate = isWorkday(today()) ? today() : nextWorkday(today());
  while (true) {
    const load = state.activities.filter((item) => item.id !== activity.id && item.date === candidate && progress(item) < 100).length;
    if (load < MAX_DAILY_OPEN) return candidate;
    candidate = nextWorkday(candidate);
  }
}

export function carryForward() {
  let changed = false;
  for (const activity of state.activities) {
    if (activity.fixed || activity.date >= today() || progress(activity) === 100) continue;
    const destination = nextAvailableWorkingDay(activity);
    if (destination !== activity.date) {
      activity.history.push({ type: "carried", from: activity.date, to: destination, at: new Date().toISOString() });
      activity.date = destination;
      activity.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) save();
  return changed;
}

function createSchedule(activity, recurrence) {
  const schedule = normalizeSchedule({
    id: uid(), frequency: recurrence.frequency, startDate: activity.date,
    until: recurrence.until || "", weekdays: recurrence.weekdays || [], template: templateFrom(activity),
  });
  activity.recurrenceId = schedule.id;
  activity.occurrenceDate = activity.date;
  state.recurrences.push(schedule);
  return schedule;
}

export function addActivity(payload, recurrence = { frequency: "none" }) {
  const activity = normalizeActivity({ ...payload, id: uid(), originalDate: payload.date, history: [] });
  state.activities.push(activity);
  if (recurrence.frequency && recurrence.frequency !== "none") createSchedule(activity, recurrence);
  if (!state.team.includes(activity.owner)) state.team.push(activity.owner);
  if (!state.verticals.includes(activity.vertical)) state.verticals.push(activity.vertical);
  syncRecurrences(lastOfMonth(shiftMonth(firstOfMonth(activity.date), 2)));
  save();
  return activity;
}

export function updateActivity(id, payload, options = {}) {
  const activity = state.activities.find((item) => item.id === id);
  if (!activity) return null;
  const previousDate = activity.date;
  Object.assign(activity, normalizeActivity({ ...activity, ...payload, id: activity.id, createdAt: activity.createdAt }));
  if (previousDate !== activity.date) activity.history.push({ type: "manual", from: previousDate, to: activity.date, at: new Date().toISOString() });
  const recurrence = options.recurrence || { frequency: "none" };
  const scope = options.scope || "occurrence";

  if (scope === "series" && activity.recurrenceId) {
    const schedule = state.recurrences.find((item) => item.id === activity.recurrenceId);
    if (recurrence.frequency === "none") {
      state.recurrences = state.recurrences.filter((item) => item.id !== activity.recurrenceId);
      state.activities = state.activities.filter((item) => item.id === activity.id || item.recurrenceId !== activity.recurrenceId || item.occurrenceDate < activity.occurrenceDate || progress(item) > 0);
      activity.recurrenceId = ""; activity.occurrenceDate = "";
    } else if (schedule) {
      schedule.frequency = recurrence.frequency;
      schedule.weekdays = recurrence.weekdays || [];
      schedule.until = recurrence.until || "";
      schedule.startDate = activity.date;
      schedule.template = templateFrom(activity);
      schedule.updatedAt = new Date().toISOString();
      state.activities = state.activities.filter((item) => item.id === activity.id || item.recurrenceId !== schedule.id || item.occurrenceDate < activity.occurrenceDate || progress(item) > 0);
      activity.occurrenceDate = activity.date;
      syncRecurrences(lastOfMonth(shiftMonth(firstOfMonth(activity.date), 2)));
    }
  } else if (!activity.recurrenceId && recurrence.frequency && recurrence.frequency !== "none") {
    createSchedule(activity, recurrence);
    syncRecurrences(lastOfMonth(shiftMonth(firstOfMonth(activity.date), 2)));
  }

  if (!state.team.includes(activity.owner)) state.team.push(activity.owner);
  if (!state.verticals.includes(activity.vertical)) state.verticals.push(activity.vertical);
  activity.updatedAt = new Date().toISOString();
  save();
  return activity;
}

export function deleteActivity(id, scope = "occurrence") {
  const activity = state.activities.find((item) => item.id === id);
  if (!activity) return;
  if (scope === "series" && activity.recurrenceId) {
    state.recurrences = state.recurrences.filter((item) => item.id !== activity.recurrenceId);
    state.activities = state.activities.filter((item) => item.recurrenceId !== activity.recurrenceId);
  } else state.activities = state.activities.filter((item) => item.id !== id);
  save();
}

export function getSchedule(activity) { return activity?.recurrenceId ? state.recurrences.find((item) => item.id === activity.recurrenceId) || null : null; }
