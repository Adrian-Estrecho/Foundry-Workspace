import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { addDays, minutesNow, startOfWeek, todayIn, toMinutes } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

/**
 * Attendance data. The report functions (attendance_shifts,
 * attendance_hours) run with the caller's RLS: admins get the whole team,
 * editors only themselves.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type WorkStatus = Enums<"work_status">;

/** "Online" before the first presence sync: seen within the last 3 minutes. */
const RECENT_MS = 3 * 60 * 1000;

// -----------------------------------------------------------------------------
// The editor's own state (top bar)
// -----------------------------------------------------------------------------
export type WorkState = {
  status: WorkStatus;
  statusSince: string;
  active: boolean;
  clockInAt: string | null;
  /** Seconds worked this shift before the current stretch. */
  workedBefore: number;
  /** When the current stretch of work started (while working). */
  stretchStartedAt: string | null;
  task: { id: string; title: string; projectName: string | null; progress: number } | null;
  renderedAt: number;
};

/** The signed-in editor's live state. Null for admins and editors still onboarding. */
export async function getWorkState(user: CurrentUser): Promise<WorkState | null> {
  if (user.role !== "editor" || user.memberStatus !== "active") return null;
  const supabase = await createClient();
  const { data: editor } = await supabase
    .from("editors")
    .select(
      `work_status, status_since, current_shift_id, is_active,
       task:tasks!editors_current_task_fkey(id, title, progress_pct, project:projects(name)),
       shift:shifts!editors_current_shift_fkey(clock_in_at)`,
    )
    .eq("id", user.id)
    .maybeSingle();
  if (!editor) return null;

  let workedBefore = 0;
  let stretchStartedAt: string | null = null;
  if (editor.current_shift_id) {
    const { data: logs } = await supabase.from("time_logs").select("started_at, ended_at").eq("shift_id", editor.current_shift_id);
    for (const log of logs ?? []) {
      if (log.ended_at) workedBefore += (Date.parse(log.ended_at) - Date.parse(log.started_at)) / 1000;
      else stretchStartedAt = log.started_at;
    }
  }

  return {
    status: editor.work_status,
    statusSince: editor.status_since,
    active: editor.is_active,
    clockInAt: editor.shift?.clock_in_at ?? null,
    workedBefore: Math.round(workedBefore),
    stretchStartedAt: editor.work_status === "working" ? stretchStartedAt : null,
    task: editor.task
      ? { id: editor.task.id, title: editor.task.title, projectName: editor.task.project?.name ?? null, progress: editor.task.progress_pct }
      : null,
    renderedAt: Date.now(),
  };
}

// -----------------------------------------------------------------------------
// Shared lookups
// -----------------------------------------------------------------------------
type EditorInfo = {
  id: string;
  name: string;
  avatarUrl: string | null;
  timeZone: string;
  isActive: boolean;
  weeklyHours: number | null;
  workDays: number[];
  shiftStart: string;
};

/**
 * The workspace's approved editors (people who see team attendance), or just
 * the caller (everyone else, or anyone asking for their own time).
 */
async function editorsFor(supabase: Supabase, user: CurrentUser, onlyMe = false): Promise<EditorInfo[]> {
  let query = supabase
    .from("editors")
    .select(
      `id, is_active, weekly_hours, work_days, shift_start,
       profile:profiles!editors_id_fkey(full_name, avatar_url, timezone),
       member:workspace_members!editors_member_fkey!inner(status)`,
    )
    .eq("member.status", "active");
  if (onlyMe || !user.permissions.includes("attendance.view")) query = query.eq("id", user.id);
  const { data } = await query;
  return (data ?? [])
    .map((e) => ({
      id: e.id,
      name: e.profile?.full_name ?? "Editor",
      avatarUrl: e.profile?.avatar_url ?? null,
      timeZone: e.profile?.timezone ?? "UTC",
      isActive: e.is_active,
      weeklyHours: e.weekly_hours,
      workDays: e.work_days,
      shiftStart: e.shift_start.slice(0, 5),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Names for people who aren't in `known` (editors who have since left). */
async function namesFor(supabase: Supabase, ids: string[], known: Map<string, { name: string; avatarUrl: string | null }>) {
  const missing = [...new Set(ids)].filter((id) => !known.has(id));
  if (missing.length) {
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", missing);
    for (const p of data ?? []) known.set(p.id, { name: p.full_name, avatarUrl: p.avatar_url });
  }
  return known;
}

type ShiftRow = {
  id: string;
  editor_id: string;
  work_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  work_seconds: number;
  break_seconds: number;
  ended_by: string | null;
  work_done: string | null;
  blockers: string | null;
  progress_pct: number | null;
  report_task_id: string | null;
};

async function shiftsBetween(supabase: Supabase, from: string, to: string): Promise<ShiftRow[]> {
  const { data, error } = await supabase.rpc("attendance_shifts", { p_from: from, p_to: to });
  if (error) throw error;
  return data ?? [];
}

/** Task titles and project names by task id (what RLS lets the caller see). */
async function taskInfo(supabase: Supabase, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, { title: string; projectId: string | null; projectName: string | null; clientId: string | null }>();
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, project:projects(id, name, client_id)")
      .in("id", unique.slice(i, i + 200));
    for (const t of data ?? []) {
      map.set(t.id, {
        title: t.title,
        projectId: t.project?.id ?? null,
        projectName: t.project?.name ?? null,
        clientId: t.project?.client_id ?? null,
      });
    }
  }
  return map;
}

/** Client names through client_directory (editors can't read client records). */
async function clientNames(supabase: Supabase, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map<string, string>();
  const { data } = await supabase.from("client_directory").select("id, company, contact_name").in("id", unique);
  return new Map((data ?? []).filter((c) => c.id).map((c) => [c.id!, c.company?.trim() || c.contact_name || "Client"] as const));
}

// -----------------------------------------------------------------------------
// Live board (admins)
// -----------------------------------------------------------------------------
export type BoardEditor = {
  id: string;
  name: string;
  avatarUrl: string | null;
  timeZone: string;
  workStatus: WorkStatus;
  statusSince: string;
  recentlySeen: boolean;
  lastSeenAt: string | null;
  task: { id: string; title: string; projectName: string | null } | null;
  clockInAt: string | null;
  localDate: string;
  scheduledToday: boolean;
  shiftStart: string;
  /** Seconds at render time; the board keeps counting while they work. */
  workedToday: number;
  breakToday: number;
  firstInToday: string | null;
  weekSeconds: number;
  weeklyHours: number | null;
};

const isoWeekday = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};

export async function getLiveBoard(user: CurrentUser) {
  const supabase = await createClient();
  const now = Date.now();
  const today = todayIn(user.timezone);

  const [{ data: rows }, shifts] = await Promise.all([
    supabase
      .from("editors")
      .select(
        `id, work_status, status_since, work_days, shift_start, weekly_hours,
         profile:profiles!editors_id_fkey(full_name, avatar_url, timezone, last_seen_at),
         task:tasks!editors_current_task_fkey(id, title, project:projects(name)),
         shift:shifts!editors_current_shift_fkey(clock_in_at),
         member:workspace_members!editors_member_fkey!inner(status)`,
      )
      .eq("is_active", true)
      .eq("member.status", "active"),
    // Wide enough for every editor's own week, whatever their time zone.
    shiftsBetween(supabase, addDays(startOfWeek(today), -1), addDays(today, 1)),
  ]);

  const editors: BoardEditor[] = (rows ?? []).map((e) => {
    const timeZone = e.profile?.timezone ?? "UTC";
    const localDate = todayIn(timeZone);
    const weekStart = startOfWeek(localDate);
    const mine = shifts.filter((s) => s.editor_id === e.id);
    const todays = mine.filter((s) => s.work_date === localDate);
    const lastSeenAt = e.profile?.last_seen_at ?? null;
    return {
      id: e.id,
      name: e.profile?.full_name ?? "Editor",
      avatarUrl: e.profile?.avatar_url ?? null,
      timeZone,
      workStatus: e.work_status,
      statusSince: e.status_since,
      recentlySeen: Boolean(lastSeenAt && now - Date.parse(lastSeenAt) < RECENT_MS),
      lastSeenAt,
      task: e.task ? { id: e.task.id, title: e.task.title, projectName: e.task.project?.name ?? null } : null,
      clockInAt: e.shift?.clock_in_at ?? null,
      localDate,
      scheduledToday: e.work_days.includes(isoWeekday(localDate)),
      shiftStart: e.shift_start.slice(0, 5),
      workedToday: todays.reduce((sum, s) => sum + s.work_seconds, 0),
      breakToday: todays.reduce((sum, s) => sum + s.break_seconds, 0),
      firstInToday: todays.map((s) => s.clock_in_at).sort()[0] ?? null,
      weekSeconds: mine.filter((s) => s.work_date >= weekStart && s.work_date <= localDate).reduce((sum, s) => sum + s.work_seconds, 0),
      weeklyHours: e.weekly_hours,
    };
  });

  editors.sort((a, b) => a.name.localeCompare(b.name));
  return { editors, renderedAt: now, today };
}

// -----------------------------------------------------------------------------
// Shift log (a day for admins; a range for an editor's own history)
// -----------------------------------------------------------------------------
export type LogShift = {
  id: string;
  editorId: string;
  editorName: string;
  avatarUrl: string | null;
  timeZone: string;
  workDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  workSeconds: number;
  breakSeconds: number;
  endedBy: string | null;
  report: { workDone: string; blockers: string | null; progress: number | null; taskTitle: string | null } | null;
};

/** onlyMe: just the caller's shifts, for people who otherwise see the team's. */
export async function getShiftLog(user: CurrentUser, from: string, to: string, { onlyMe = false } = {}) {
  const supabase = await createClient();
  const [all, editors] = await Promise.all([shiftsBetween(supabase, from, to), editorsFor(supabase, user, onlyMe)]);
  const shifts = onlyMe ? all.filter((s) => s.editor_id === user.id) : all;
  const people = await namesFor(
    supabase,
    shifts.map((s) => s.editor_id),
    new Map(editors.map((e) => [e.id, { name: e.name, avatarUrl: e.avatarUrl }])),
  );
  const zones = new Map(editors.map((e) => [e.id, e.timeZone]));
  const tasks = await taskInfo(supabase, shifts.map((s) => s.report_task_id));

  const log: LogShift[] = shifts.map((s) => ({
    id: s.id,
    editorId: s.editor_id,
    editorName: people.get(s.editor_id)?.name ?? "Editor",
    avatarUrl: people.get(s.editor_id)?.avatarUrl ?? null,
    timeZone: zones.get(s.editor_id) ?? user.timezone,
    workDate: s.work_date,
    clockInAt: s.clock_in_at,
    clockOutAt: s.clock_out_at,
    workSeconds: s.work_seconds,
    breakSeconds: s.break_seconds,
    endedBy: s.ended_by,
    report: s.work_done
      ? {
          workDone: s.work_done,
          blockers: s.blockers,
          progress: s.progress_pct,
          taskTitle: s.report_task_id ? (tasks.get(s.report_task_id)?.title ?? null) : null,
        }
      : null,
  }));

  // Scheduled editors with no shift that day, once their start time has
  // passed where they are (a single day's log only).
  const now = Date.now();
  const due = (e: EditorInfo) => {
    const localToday = todayIn(e.timeZone);
    if (from > localToday) return false;
    return from < localToday || minutesNow(e.timeZone, now) >= toMinutes(e.shiftStart);
  };
  const absent =
    !onlyMe && user.permissions.includes("attendance.view") && from === to
      ? editors
          .filter((e) => e.isActive && e.workDays.includes(isoWeekday(from)) && due(e) && !log.some((s) => s.editorId === e.id))
          .map((e) => ({ id: e.id, name: e.name, avatarUrl: e.avatarUrl, shiftStart: e.shiftStart }))
      : [];

  return { shifts: log, absent, renderedAt: Date.now() };
}

// -----------------------------------------------------------------------------
// Timesheet: hours per editor per day for one week
// -----------------------------------------------------------------------------
export type TimesheetRow = {
  editorId: string;
  name: string;
  avatarUrl: string | null;
  weeklyHours: number | null;
  perDay: Record<string, number>;
  total: number;
  open: boolean;
};

export async function getTimesheet(user: CurrentUser, weekStart: string, { onlyMe = false } = {}) {
  const supabase = await createClient();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const [all, editors] = await Promise.all([shiftsBetween(supabase, days[0], days[6]), editorsFor(supabase, user, onlyMe)]);
  const shifts = onlyMe ? all.filter((s) => s.editor_id === user.id) : all;
  const people = await namesFor(
    supabase,
    shifts.map((s) => s.editor_id),
    new Map(editors.map((e) => [e.id, { name: e.name, avatarUrl: e.avatarUrl }])),
  );

  const byEditor = new Map<string, TimesheetRow>();
  const rowFor = (id: string) => {
    let row = byEditor.get(id);
    if (!row) {
      const editor = editors.find((e) => e.id === id);
      row = {
        editorId: id,
        name: people.get(id)?.name ?? "Editor",
        avatarUrl: people.get(id)?.avatarUrl ?? null,
        weeklyHours: editor?.weeklyHours ?? null,
        perDay: {},
        total: 0,
        open: false,
      };
      byEditor.set(id, row);
    }
    return row;
  };
  for (const editor of editors) if (editor.isActive) rowFor(editor.id);
  for (const shift of shifts) {
    const row = rowFor(shift.editor_id);
    row.perDay[shift.work_date] = (row.perDay[shift.work_date] ?? 0) + shift.work_seconds;
    row.total += shift.work_seconds;
    if (!shift.clock_out_at) row.open = true;
  }

  const rows = [...byEditor.values()].sort((a, b) => a.name.localeCompare(b.name));
  const totals = Object.fromEntries(days.map((day) => [day, rows.reduce((sum, r) => sum + (r.perDay[day] ?? 0), 0)]));
  return { days, rows, totals, total: rows.reduce((sum, r) => sum + r.total, 0) };
}

// -----------------------------------------------------------------------------
// Hours per client, project and task
// -----------------------------------------------------------------------------
export type HoursTask = { taskId: string | null; title: string; seconds: number; editors: { id: string; name: string; seconds: number }[] };
export type HoursProject = { key: string; projectId: string | null; projectName: string; clientName: string | null; seconds: number; tasks: HoursTask[] };

export async function getHours(user: CurrentUser, from: string, to: string) {
  const supabase = await createClient();
  const [{ data: rows, error }, editors] = await Promise.all([
    supabase.rpc("attendance_hours", { p_from: from, p_to: to }),
    editorsFor(supabase, user),
  ]);
  if (error) throw error;
  const logs = (rows ?? []).map((r) => ({ editorId: r.editor_id, taskId: r.task_id, seconds: Number(r.seconds) }));

  const tasks = await taskInfo(supabase, logs.map((l) => l.taskId));
  const clients = await clientNames(supabase, [...tasks.values()].map((t) => t.clientId));
  const people = await namesFor(
    supabase,
    logs.map((l) => l.editorId),
    new Map(editors.map((e) => [e.id, { name: e.name, avatarUrl: e.avatarUrl }])),
  );

  const projects = new Map<string, HoursProject>();
  for (const log of logs) {
    const task = log.taskId ? tasks.get(log.taskId) : undefined;
    const key = task?.projectId ?? (task ? "internal" : "none");
    let project = projects.get(key);
    if (!project) {
      project = {
        key,
        projectId: task?.projectId ?? null,
        projectName: task?.projectName ?? (task ? "Internal work" : "No task picked"),
        clientName: task?.clientId ? (clients.get(task.clientId) ?? null) : null,
        seconds: 0,
        tasks: [],
      };
      projects.set(key, project);
    }
    project.seconds += log.seconds;

    const taskKey = log.taskId && task ? log.taskId : null;
    let entry = project.tasks.find((t) => t.taskId === taskKey);
    if (!entry) {
      entry = {
        taskId: taskKey,
        title: task?.title ?? (log.taskId ? "A task you can no longer open" : "No task picked"),
        seconds: 0,
        editors: [],
      };
      project.tasks.push(entry);
    }
    entry.seconds += log.seconds;
    const person = entry.editors.find((e) => e.id === log.editorId);
    if (person) person.seconds += log.seconds;
    else entry.editors.push({ id: log.editorId, name: people.get(log.editorId)?.name ?? "Editor", seconds: log.seconds });
  }

  const byProject = [...projects.values()]
    .map((p) => ({
      ...p,
      tasks: p.tasks.map((t) => ({ ...t, editors: t.editors.sort((a, b) => b.seconds - a.seconds) })).sort((a, b) => b.seconds - a.seconds),
    }))
    .sort((a, b) => b.seconds - a.seconds);

  const perEditor = new Map<string, number>();
  for (const log of logs) perEditor.set(log.editorId, (perEditor.get(log.editorId) ?? 0) + log.seconds);
  const byEditor = [...perEditor.entries()]
    .map(([id, seconds]) => ({ id, name: people.get(id)?.name ?? "Editor", avatarUrl: people.get(id)?.avatarUrl ?? null, seconds }))
    .sort((a, b) => b.seconds - a.seconds);

  return { projects: byProject, editors: byEditor, total: logs.reduce((sum, l) => sum + l.seconds, 0) };
}
