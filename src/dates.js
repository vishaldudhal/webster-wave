const pad = (value) => String(value).padStart(2, "0");

export const toLocalDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const parseDate = (value) => new Date(`${value}T12:00:00`);
export const today = () => toLocalDate(new Date());
export const shiftDate = (value, amount) => { const date = parseDate(value); date.setDate(date.getDate() + amount); return toLocalDate(date); };
export const firstOfMonth = (value = today()) => { const date = parseDate(value); date.setDate(1); return toLocalDate(date); };
export const lastOfMonth = (value) => { const date = parseDate(value); date.setMonth(date.getMonth() + 1, 0); return toLocalDate(date); };
export const daysInMonth = (value) => parseDate(lastOfMonth(value)).getDate();
export const shiftMonth = (value, amount) => { const date = parseDate(firstOfMonth(value)); date.setMonth(date.getMonth() + amount); return toLocalDate(date); };
export const startOfWeek = (value = today()) => { const date = parseDate(value); const offset = (date.getDay() + 6) % 7; date.setDate(date.getDate() - offset); return toLocalDate(date); };
export const endOfWeek = (value = today()) => shiftDate(startOfWeek(value), 6);
export const weekDay = (value, short = false) => parseDate(value).toLocaleDateString("en-IN", { weekday: short ? "short" : "long" });
export const niceDate = (value, options = {}) => value ? parseDate(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...options }) : "Not set";
export const isWorkday = (value) => ![0, 6].includes(parseDate(value).getDay());
export const nextWorkday = (value) => { let next = shiftDate(value, 1); while (!isWorkday(next)) next = shiftDate(next, 1); return next; };
export const dateRange = (start, end) => { const dates = []; for (let date = start; date <= end; date = shiftDate(date, 1)) dates.push(date); return dates; };
export const monthTitle = (value) => parseDate(value).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
export const weekdayNumber = (value) => parseDate(value).getDay();
