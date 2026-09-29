/**
 * Date helpers. Calendar dates travel as "YYYY-MM-DD" strings (Postgres
 * `date`), and "today" is always computed in a specific timezone so a
 * deadline means the same thing on the server and in the browser.
 */

/** Today's date in `timeZone`, as YYYY-MM-DD. */
export function todayIn(timeZone: string, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string) {
  const [a, b] = [from, to].map((value) => {
    const [y, m, d] = value.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

const utcDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** "Mon, Sep 28" */
export function formatDay(date: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(utcDate(date));
}

/** "Due today" / "Due tomorrow" / "2 days overdue" / "Due Fri, Oct 2" */
export function dueLabel(dueDate: string, today: string) {
  const diff = daysBetween(today, dueDate);
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff === -1) return "1 day overdue";
  if (diff < 0) return `${-diff} days overdue`;
  if (diff < 7) return `Due ${formatDay(dueDate, { weekday: "long" })}`;
  return `Due ${formatDay(dueDate)}`;
}

/** "today", "tomorrow", "in 3 days", "2 days overdue": for use after a written-out date. */
export function relativeDue(dueDate: string, today: string) {
  const diff = daysBetween(today, dueDate);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "1 day overdue";
  return diff < 0 ? `${-diff} days overdue` : `in ${diff} days`;
}

/** 8130 → "2h 15m"; 45 → "<1m" */
export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0 && m === 0) return "<1m";
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** 8130 → "2:15:30" */
export function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Seconds → hours with one decimal, e.g. "12.5" */
export function toHours(seconds: number) {
  return Math.round((seconds / 3600) * 10) / 10;
}

/** "just now", "5m ago", "3h ago", "2d ago", then a date. */
export function timeAgo(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 7 * 86_400) return `${Math.round(diff / 86_400)}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

export function greeting(timeZone: string, now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "9:02 AM" in `timeZone`; with `withZone`, "9:02 AM EDT". */
export function formatTime(iso: string, timeZone: string, withZone = false) {
  const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZoneName: withZone ? "short" : undefined };
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(iso));
  }
}

/** "09:00" (a time of day) → "9:00 AM" */
export function formatTimeOfDay(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Minutes past midnight right now in `timeZone`. */
export function minutesNow(timeZone: string, now: number = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** "09:30" → 570 */
export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Monday (YYYY-MM-DD) of the week containing `date`. */
export function startOfWeek(date: string) {
  const day = utcDate(date).getUTCDay(); // 0 = Sunday
  return addDays(date, day === 0 ? -6 : 1 - day);
}
