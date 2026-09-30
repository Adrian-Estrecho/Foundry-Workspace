import { addDays, startOfWeek } from "@/lib/dates";

/** What the Attendance page can show, by access. Kept in the URL (?view=). */
export const ADMIN_VIEWS = [
  { value: "live", label: "Live board" },
  { value: "log", label: "Daily log" },
  { value: "timesheet", label: "Timesheets" },
  { value: "hours", label: "Hours" },
] as const;

export const EDITOR_VIEWS = [
  { value: "mine", label: "My time" },
  { value: "timesheet", label: "Timesheet" },
  { value: "hours", label: "Hours" },
] as const;

export type AttendanceView = (typeof ADMIN_VIEWS)[number]["value"] | (typeof EDITOR_VIEWS)[number]["value"];

/**
 * The team's views for people who see attendance; an editor among them keeps
 * "My time" first. Everyone else gets their own time only.
 */
export function attendanceViews({ team, editor }: { team: boolean; editor: boolean }): readonly { value: AttendanceView; label: string }[] {
  if (!team) return EDITOR_VIEWS;
  return editor ? [EDITOR_VIEWS[0], ...ADMIN_VIEWS] : ADMIN_VIEWS;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: unknown): value is string =>
  typeof value === "string" && DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Hours report ranges offered as one-click presets. */
export const RANGE_PRESETS = [
  { value: "this-week", label: "This week" },
  { value: "last-week", label: "Last week" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "30-days", label: "Last 30 days" },
] as const;

export function presetRange(preset: (typeof RANGE_PRESETS)[number]["value"], today: string) {
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (preset) {
    case "this-week":
      return { from: startOfWeek(today), to: today };
    case "last-week": {
      const start = addDays(startOfWeek(today), -7);
      return { from: start, to: addDays(start, 6) };
    }
    case "this-month":
      return { from: monthStart, to: today };
    case "last-month": {
      const lastEnd = addDays(monthStart, -1);
      return { from: `${lastEnd.slice(0, 7)}-01`, to: lastEnd };
    }
    case "30-days":
      return { from: addDays(today, -29), to: today };
  }
}

export type AttendanceParams = {
  view: AttendanceView;
  /** Daily log day. */
  date: string;
  /** Timesheet week (a Monday). */
  week: string;
  /** Hours report range, at most a year. */
  from: string;
  to: string;
};

export function parseAttendanceParams(
  params: Record<string, string | string[] | undefined>,
  { views, today }: { views: readonly { value: string }[]; today: string },
): AttendanceParams {
  const requested = first(params.view);
  const view = (views.some((v) => v.value === requested) ? requested : views[0].value) as AttendanceView;

  const date = isDate(first(params.date)) ? first(params.date)! : today;
  const week = startOfWeek(isDate(first(params.week)) ? first(params.week)! : today);

  let from = isDate(first(params.from)) ? first(params.from)! : startOfWeek(today);
  let to = isDate(first(params.to)) ? first(params.to)! : today;
  if (from > to) [from, to] = [to, from];
  if (from < addDays(to, -366)) from = addDays(to, -366);

  return { view, date, week, from, to };
}

/** "?view=log&date=…" for links between views. */
export function attendanceHref(patch: Partial<AttendanceParams> & { view: AttendanceView }) {
  const search = new URLSearchParams();
  search.set("view", patch.view);
  if (patch.date) search.set("date", patch.date);
  if (patch.week) search.set("week", patch.week);
  if (patch.from) search.set("from", patch.from);
  if (patch.to) search.set("to", patch.to);
  return `/attendance?${search}`;
}
