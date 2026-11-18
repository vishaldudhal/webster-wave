import { BUSINESS_ACTIVITY_TEMPLATES, CONTENT_LIFECYCLE, CONTENT_TEMPLATES, DEFAULT_OWNER, DEFAULT_VERTICALS, MARKETING_CHANNELS, MAX_DAILY_OPEN, PRIORITIES, STORAGE_KEY, VERTICAL_TEMPLATES } from "./config.js";
import { dateRange, firstOfMonth, lastOfMonth, parseDate, shiftDate, shiftMonth, today, toLocalDate, weekdayNumber } from "./dates.js";

export const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
export const progress = (activity) => activity.items.length ? Math.round((activity.items.filter((item) => item.done).length / activity.items.length) * 100) : activity.manualDone ? 100 : 0;
export const statusOf = (activity) => progress(activity) === 100 ? "Completed" : progress(activity) ? "In progress" : "Scheduled";
export const isFollowUpDue = (activity) => activity.followUpDate && activity.followUpDate <= today() && !activity.followUpDone;

const cleanText = (value) => String(value || "").trim();
const normalizeItem = (item) => ({ id: item?.id || uid(), label: cleanText(item?.label) || "Checklist item", done: Boolean(item?.done) });
const normalizeAttachment = (file) => ({ id: file?.id || uid(), name: cleanText(file?.name) || "Attachment", type: cleanText(file?.type), size: Number(file?.size || 0), data: String(file?.data || "") });
const normalizeMarketingChannel = (value) => ({ Blog: "Blogs", "Life at Webster Blog": "Blogs", "General Blog": "Blogs", Twitter: "Twitter / X", X: "Twitter / X" }[cleanText(value)] || cleanText(value));
const normalizeLifecycle = (value, fallback = "Planned") => {
  const migrated = value === "Idea" ? "Planned" : value === "In review" ? "In Review" : value;
  return CONTENT_LIFECYCLE.includes(migrated) ? migrated : fallback;
};
const normalizePublicationTarget = (target) => ({ channel: normalizeMarketingChannel(target?.channel), status: normalizeLifecycle(target?.status, "Scheduled") });

export function normalizeActivity(activity = {}) {
  const date = activity.date || today();
  const legacyChannelName = normalizeMarketingChannel(activity.platform);
  const legacyChannel = activity.vertical === "Marketing" && MARKETING_CHANNELS.includes(legacyChannelName) ? [{ channel: legacyChannelName, status: activity.manualDone ? "Published" : "Scheduled" }] : [];
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
    kind: activity.kind === "content" || (activity.vertical === "Marketing" && (activity.publicationTargets?.length || activity.contentFormat)) ? "content" : "activity",
    contentFormat: cleanText(activity.contentFormat),
    contentStatus: normalizeLifecycle(activity.contentStatus || (activity.manualDone ? "Published" : "Planned")),
    blogType: cleanText(activity.blogType) || (activity.platform === "Life at Webster Blog" ? "Life at Webster" : activity.platform === "General Blog" ? "General Blog" : ""),
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
    publicationTargets: Array.from(new Map((Array.isArray(activity.publicationTargets) ? activity.publicationTargets : legacyChannel).map(normalizePublicationTarget).filter((target) => target.channel).map((target) => [target.channel, target])).values()),
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
    title: activity.title, vertical: activity.vertical, owner: activity.owner, priority: activity.priority, kind: activity.kind,
    contentFormat: activity.contentFormat, contentStatus: activity.contentStatus,
    platform: activity.platform, activityType: activity.activityType, category: activity.category, blogType: activity.blogType,
    topic: activity.topic, additionalDetails: activity.additionalDetails, notes: activity.notes,
    resources: activity.resources, outcome: "", followUpDate: "", followUpDone: false,
    fixed: activity.fixed, attachments: activity.attachments, publicationTargets: activity.publicationTargets,
    checklist: activity.items.map((item) => item.label),
  };
}

function createDemoState(profile = { name: DEFAULT_OWNER, email: "", role: "Business Development" }) {
  const base = today();
  const team = [profile.name || DEFAULT_OWNER, "Aisha", "Rahul"];
  const make = (offset, title, vertical, options = {}) => {
    const labels = options.steps || VERTICAL_TEMPLATES[vertical] || [];
    const date = shiftDate(base, offset);
    return normalizeActivity({
      title, vertical, date, originalDate: options.originalDate || date,
      owner: options.owner || team[0], priority: options.priority || "Medium",
      platform: options.platform || "", activityType: options.activityType || "",
      category: options.category || "", topic: options.topic || "", blogType: options.blogType || "",
      additionalDetails: options.details || "", notes: options.notes || "", outcome: options.outcome || "",
      resources: options.resources || "", followUpDate: options.followUpDate || "", followUpDone: Boolean(options.followUpDone),
      fixed: Boolean(options.fixed), manualDone: Boolean(options.manualDone), publicationTargets: options.publicationTargets || [],
      items: labels.map((label, index) => ({ label, done: index < (options.completed || 0) })),
      history: options.history || [], recurrenceId: options.recurrenceId || "", occurrenceDate: options.occurrenceDate || "",
    });
  };

  const carriedFrom = shiftDate(base, -2);
  const recurrenceId = uid();
  let recurringDate = base;
  while (weekdayNumber(recurringDate) !== 5) recurringDate = shiftDate(recurringDate, 1);
  const activities = [
    make(0, "Publish the November LinkedIn insight", "Marketing", { owner: "Aisha", platform: "LinkedIn", activityType: "Post", category: "Awareness", topic: "Why consistency compounds in digital growth", priority: "High", completed: 4, publicationTargets: [{ channel: "LinkedIn", status: "Scheduled" }, { channel: "Twitter / X", status: "Draft" }], details: "Final copy approved. Add the client-safe example and schedule for 5:30 PM.", notes: "Use the sage campaign template.", resources: "https://webster.co.in" }),
    make(0, "Follow up with five warm prospects", "Direct Outreach", { priority: "High", platform: "Email", activityType: "Follow-up", category: "Conversion", completed: 3, followUpDate: base, details: "Prioritize the prospects who opened the proposal twice.", notes: "Personalize the first line for each contact." }),
    make(0, "Qualify the new website enquiry", "Inbound", { owner: "Rahul", priority: "High", platform: "Website", activityType: "Call", category: "Lead generation", completed: 2, followUpDate: base, details: "Discovery call for a manufacturing website redesign.", resources: "https://webster.co.in/contact" }),
    make(0, "Visit the Kothrud manufacturing cluster", "Local Business Development", { fixed: true, platform: "In person", activityType: "Visit", category: "Lead generation", completed: 1, details: "Meet three shortlisted businesses and record decision-maker details." }),
    make(0, "Send the revised partnership proposal", "Partnerships", { owner: "Rahul", priority: "High", platform: "Email", activityType: "Proposal", category: "Partnership", completed: 3, originalDate: carriedFrom, history: [{ type: "carried", from: carriedFrom, to: base, at: new Date().toISOString() }], details: "Updated scope includes referral ownership and quarterly co-marketing." }),
    make(0, "Introduce Webster to Rohan’s founder network", "Existing Network", { completed: 6, platform: "WhatsApp", activityType: "Follow-up", category: "Relationship", outcome: "Warm introduction made to two founders." }),
    make(1, "Create the client-results carousel", "Marketing", { owner: "Aisha", platform: "Instagram", activityType: "Post", category: "Awareness", completed: 2, publicationTargets: [{ channel: "Instagram", status: "Draft" }, { channel: "Facebook", status: "Idea" }], details: "Five slides: challenge, approach, transformation, metric, CTA." }),
    make(1, "Reconnect with Meridian Engineering", "Past Client Development", { priority: "High", platform: "Phone", activityType: "Call", category: "Retention", completed: 1, followUpDate: shiftDate(base, 2), details: "Explore annual website maintenance and SEO support." }),
    make(2, "Draft Life at Webster culture story", "Marketing", { owner: "Aisha", platform: "Life at Webster Blog", blogType: "Life at Webster", activityType: "Article", category: "Engagement", completed: 2, publicationTargets: [{ channel: "Blogs", status: "Draft" }, { channel: "LinkedIn", status: "Idea" }], topic: "How the team runs Monday planning", details: "Include candid team photographs and one quote from each department." }),
    make(2, "Explore co-selling with Northstar Consulting", "Partnerships", { owner: "Rahul", platform: "Meeting", activityType: "Meeting", category: "Partnership", completed: 2, followUpDate: shiftDate(base, 4), details: "Define the shared ICP and referral handoff." }),
    make(3, "Record the website audit walkthrough", "Marketing", { owner: "Aisha", platform: "YouTube", activityType: "Video", category: "Awareness", priority: "High", completed: 1, publicationTargets: [{ channel: "YouTube", status: "In review" }, { channel: "Instagram", status: "Idea" }], details: "Eight-minute screen recording with three actionable fixes." }),
    make(3, "Friday pipeline and follow-up review", "Existing Network", { recurrenceId, occurrenceDate: recurringDate, platform: "Meeting", activityType: "Review", category: "Relationship", completed: 0, fixed: true, details: "Review every open conversation and set the next action." }),
    make(4, "Attend Pune Founders Circle meetup", "Events & Networking", { owner: "Rahul", fixed: true, platform: "In person", activityType: "Event", category: "Networking", completed: 1, details: "Target five meaningful conversations, not card collection." }),
    make(5, "Prepare the local business audit offer", "Local Business Development", { platform: "Website", activityType: "Proposal", category: "Conversion", completed: 2, details: "Package a 30-minute digital presence audit for local manufacturers." }),
    make(6, "Build a shortlist of SaaS founders", "Direct Outreach", { owner: "Rahul", platform: "LinkedIn", activityType: "Research", category: "Lead generation", completed: 1, details: "Twenty Maharashtra-based B2B SaaS companies with 10–100 employees." }),
    make(7, "Publish the monthly founder note", "Marketing", { platform: "General Blog", blogType: "General Blog", activityType: "Article", category: "Awareness", completed: 1, publicationTargets: [{ channel: "Blogs", status: "Idea" }, { channel: "LinkedIn", status: "Idea" }, { channel: "Twitter / X", status: "Idea" }], topic: "Sustainable growth beats random activity" }),
    make(8, "Review dormant client opportunities", "Past Client Development", { owner: "Rahul", platform: "Email", activityType: "Research", category: "Retention", completed: 0, details: "Review the last twelve months and identify five relevant re-entry points." }),
    make(9, "Plan the December content calendar", "Marketing", { owner: "Aisha", platform: "Meeting", activityType: "Planning", category: "Awareness", completed: 0, publicationTargets: [{ channel: "Instagram", status: "Idea" }, { channel: "Facebook", status: "Idea" }, { channel: "LinkedIn", status: "Idea" }, { channel: "YouTube", status: "Idea" }] }),
    make(10, "Respond to the e-commerce redesign enquiry", "Inbound", { priority: "High", platform: "Email", activityType: "Proposal", category: "Conversion", completed: 0, followUpDate: shiftDate(base, 11), details: "Send relevant work, process, timeline range, and discovery questions." }),
    make(-1, "Publish the Diwali campaign recap", "Marketing", { owner: "Aisha", platform: "Instagram", activityType: "Post", category: "Engagement", completed: 6, publicationTargets: [{ channel: "Instagram", status: "Published" }, { channel: "Facebook", status: "Published" }], outcome: "4.8% engagement rate and three inbound conversations." }),
    make(-1, "Complete the referral conversation with Neha", "Existing Network", { completed: 6, platform: "Phone", activityType: "Call", category: "Relationship", outcome: "Introduction scheduled for next week." }),
    make(-2, "Follow up after the industrial expo", "Events & Networking", { owner: "Rahul", completed: 6, platform: "Email", activityType: "Follow-up", category: "Networking", outcome: "Six replies, two discovery calls booked." }),
    make(-3, "Send the quarterly care-plan review", "Past Client Development", { completed: 6, platform: "Email", activityType: "Review", category: "Retention", outcome: "Renewal confirmed for another quarter." }),
  ];
  const recurrence = normalizeSchedule({ id: recurrenceId, frequency: "weekly", startDate: recurringDate, template: { title: "Friday pipeline and follow-up review", vertical: "Existing Network", owner: team[0], priority: "Medium", platform: "Meeting", activityType: "Review", category: "Relationship", additionalDetails: "Review every open conversation and set the next action.", fixed: true, checklist: VERTICAL_TEMPLATES["Existing Network"] } });
  return { schemaVersion: 5, activities, recurrences: [recurrence], team, verticals: [...DEFAULT_VERTICALS], profile: { name: profile.name || DEFAULT_OWNER, email: profile.email || "", role: profile.role || "Business Development", avatar: profile.avatar || "" }, settings: { workingDays: [1, 2, 3, 4, 5], holidays: [], reminderEnabled: true, reminderTime: "10:00", defaultPlannerView: "week", timezone: "Asia/Kolkata", autoReschedule: true, notificationFollowUps: true, notificationOverdue: true, notificationReviews: true, notificationPublishing: true }, templates: { ...VERTICAL_TEMPLATES }, activityTemplates: { ...BUSINESS_ACTIVITY_TEMPLATES }, contentTemplates: { ...CONTENT_TEMPLATES }, memberDetails: {} };
}

function readState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.activities)) {
      const activities = stored.activities.map(normalizeActivity);
      return {
        ...stored,
        schemaVersion: 5,
        activities,
        recurrences: Array.isArray(stored.recurrences) ? stored.recurrences.map(normalizeSchedule) : [],
        team: Array.from(new Set([DEFAULT_OWNER, ...(stored.team || []), ...activities.map((item) => item.owner).filter(Boolean)])),
        verticals: Array.from(new Set([...DEFAULT_VERTICALS, ...(stored.verticals || []), ...activities.map((item) => item.vertical).filter(Boolean)])),
        profile: { name: DEFAULT_OWNER, email: "", role: "Business Development", avatar: "", ...(stored.profile || {}) },
        settings: { workingDays: [1, 2, 3, 4, 5], holidays: [], reminderEnabled: true, reminderTime: "10:00", defaultPlannerView: "week", timezone: "Asia/Kolkata", autoReschedule: true, notificationFollowUps: true, notificationOverdue: true, notificationReviews: true, notificationPublishing: true, ...(stored.settings || {}) },
        templates: { ...VERTICAL_TEMPLATES, ...(stored.templates || {}) },
        activityTemplates: { ...BUSINESS_ACTIVITY_TEMPLATES, ...(stored.activityTemplates || {}) },
        contentTemplates: { ...CONTENT_TEMPLATES, ...(stored.contentTemplates || {}) },
        memberDetails: stored.memberDetails && typeof stored.memberDetails === "object" ? stored.memberDetails : {},
      };
    }
  } catch { /* Fall through to starter data. */ }
  return createDemoState();
}

export const state = readState();
export function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function normalizedState(source) {
  if (!source || typeof source !== "object" || !Array.isArray(source.activities)) throw new Error("This file does not contain a valid WAVE plan.");
  if (Number(source.schemaVersion || 1) > 5) throw new Error("This backup was created by a newer version of WAVE.");
  if (source.recurrences != null && !Array.isArray(source.recurrences)) throw new Error("The recurring schedule data is invalid.");
  const activities = source.activities.map(normalizeActivity);
  return {
    schemaVersion: 5,
    activities,
    recurrences: (source.recurrences || []).map(normalizeSchedule),
    team: Array.from(new Set([DEFAULT_OWNER, ...(Array.isArray(source.team) ? source.team : []), ...activities.map((item) => item.owner).filter(Boolean)])),
    verticals: Array.from(new Set([...DEFAULT_VERTICALS, ...(Array.isArray(source.verticals) ? source.verticals : []), ...activities.map((item) => item.vertical).filter(Boolean)])),
    profile: { name: DEFAULT_OWNER, email: "", role: "Business Development", avatar: "", ...(source.profile || {}) },
    settings: { workingDays: [1, 2, 3, 4, 5], holidays: [], reminderEnabled: true, reminderTime: "10:00", defaultPlannerView: "week", timezone: "Asia/Kolkata", autoReschedule: true, notificationFollowUps: true, notificationOverdue: true, notificationReviews: true, notificationPublishing: true, ...(source.settings || {}) },
    templates: { ...VERTICAL_TEMPLATES, ...(source.templates || {}) },
    activityTemplates: { ...BUSINESS_ACTIVITY_TEMPLATES, ...(source.activityTemplates || {}) },
    contentTemplates: { ...CONTENT_TEMPLATES, ...(source.contentTemplates || {}) },
    memberDetails: source.memberDetails && typeof source.memberDetails === "object" ? source.memberDetails : {},
  };
}

export function createBackup() {
  return {
    format: "webster-wave-backup",
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: "1.1.0",
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

export function loadDemoData() {
  const demo = createDemoState(state.profile);
  demo.settings = { ...state.settings };
  demo.templates = { ...VERTICAL_TEMPLATES, ...state.templates };
  demo.activityTemplates = { ...BUSINESS_ACTIVITY_TEMPLATES, ...state.activityTemplates };
  demo.contentTemplates = { ...CONTENT_TEMPLATES, ...state.contentTemplates };
  demo.memberDetails = { ...state.memberDetails };
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, demo);
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
  const allowed = (value) => state.settings.workingDays.includes(weekdayNumber(value)) && !state.settings.holidays.includes(value);
  const nextAllowed = (value) => { let candidate = shiftDate(value, 1); while (!allowed(candidate)) candidate = shiftDate(candidate, 1); return candidate; };
  let candidate = allowed(today()) ? today() : nextAllowed(today());
  while (true) {
    const load = state.activities.filter((item) => item.id !== activity.id && item.date === candidate && progress(item) < 100).length;
    if (load < MAX_DAILY_OPEN) return candidate;
    candidate = nextAllowed(candidate);
  }
}

export function carryForward() {
  if (state.settings.autoReschedule === false) return [];
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
