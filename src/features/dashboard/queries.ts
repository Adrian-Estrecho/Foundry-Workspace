import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { addDays, startOfWeek, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

/** "Online" before the first presence sync: seen within the last 3 minutes. */
const RECENT_MS = 3 * 60 * 1000;
const seenRecently = (lastSeenAt: string | null | undefined, now: number) =>
  Boolean(lastSeenAt && now - new Date(lastSeenAt).getTime() < RECENT_MS);

export type TeamMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  workStatus: Enums<"work_status">;
  taskTitle: string | null;
  projectName: string | null;
  clockInAt: string | null;
  statusSince: string;
  recentlySeen: boolean;
};

export type DueTask = {
  id: string;
  title: string;
  dueDate: string;
  priority: Enums<"task_priority">;
  status: Enums<"task_status">;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  context: string | null; // "Northwind Fitness · Q4 Reels Package"
};

export type ActivityItem = {
  id: number;
  summary: string;
  action: string;
  createdAt: string;
  actorName: string | null;
  actorAvatar: string | null;
};

export type DailyHours = { day: string; seconds: number };
export type MonthlyCount = { month: string; completed: number };

/** Hours per day for the last 52 weeks (enough for a 6-month range + comparison). */
async function hoursHistory(timeZone: string, today: string): Promise<DailyHours[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("team_hours_by_day", {
    p_from: startOfWeek(addDays(today, -363)),
    p_to: today,
    p_tz: timeZone,
  });
  return (data ?? []).map((row) => ({ day: row.day, seconds: Number(row.seconds) }));
}

async function completedByMonth(timeZone: string): Promise<MonthlyCount[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("tasks_completed_by_month", { p_months: 6, p_tz: timeZone });
  return (data ?? []).map((row) => ({ month: row.month, completed: Number(row.completed) }));
}

// -----------------------------------------------------------------------------
// Admin
// -----------------------------------------------------------------------------
export async function getAdminDashboard(user: CurrentUser) {
  const supabase = await createClient();
  const timeZone = user.timezone;
  const today = todayIn(timeZone);
  const weekEnd = addDays(today, 6);
  const now = Date.now();
  const count = { count: "exact" as const, head: true };

  const [
    activeClients,
    activeProjects,
    dueToday,
    overdue,
    newLeads,
    newApplicants,
    editors,
    tasks,
    activity,
    applicants,
    hours,
    completed,
  ] = await Promise.all([
    supabase.from("clients").select("id", count).in("stage", ["kickoff", "active_client"]),
    supabase.from("projects").select("id", count).neq("status", "delivered"),
    supabase.from("tasks").select("id", count).eq("due_date", today).neq("status", "done"),
    supabase.from("tasks").select("id", count).lt("due_date", today).neq("status", "done"),
    supabase.from("clients").select("id", count).eq("stage", "new_lead"),
    supabase.from("applicants").select("id", count).eq("stage", "applied"),
    supabase
      .from("editors")
      .select(
        `id, work_status, status_since, weekly_hours,
         profile:profiles!editors_id_fkey(full_name, avatar_url, last_seen_at),
         task:tasks!editors_current_task_fkey(title, project:projects(name)),
         shift:shifts!editors_current_shift_fkey(clock_in_at)`,
      )
      .eq("is_active", true),
    supabase
      .from("tasks")
      .select(
        `id, title, due_date, priority, status, assignee_id,
         assignee:editors!tasks_assignee_id_fkey(profile:profiles!editors_id_fkey(full_name, avatar_url)),
         project:projects(name, client:clients(company))`,
      )
      .neq("status", "done")
      .not("due_date", "is", null)
      .lte("due_date", weekEnd)
      .order("due_date")
      .order("priority", { ascending: false }),
    supabase
      .from("activity_log")
      .select("id, action, summary, created_at, actor:profiles(full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("applicants")
      .select("id, full_name")
      .eq("stage", "applied")
      .order("created_at", { ascending: false })
      .limit(4),
    hoursHistory(timeZone, today),
    completedByMonth(timeZone),
  ]);

  const team: TeamMember[] = (editors.data ?? []).map((editor) => ({
    id: editor.id,
    name: editor.profile?.full_name ?? "Editor",
    avatarUrl: editor.profile?.avatar_url ?? null,
    workStatus: editor.work_status,
    taskTitle: editor.task?.title ?? null,
    projectName: editor.task?.project?.name ?? null,
    clockInAt: editor.shift?.clock_in_at ?? null,
    statusSince: editor.status_since,
    recentlySeen: seenRecently(editor.profile?.last_seen_at, now),
  }));

  const dueTasks: DueTask[] = (tasks.data ?? []).map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: task.due_date!,
    priority: task.priority,
    status: task.status,
    assigneeId: task.assignee_id,
    assigneeName: task.assignee?.profile?.full_name ?? null,
    assigneeAvatar: task.assignee?.profile?.avatar_url ?? null,
    context: [task.project?.client?.company, task.project?.name].filter(Boolean).join(" · ") || "Internal",
  }));

  return {
    today,
    timeZone,
    renderedAt: now,
    kpis: {
      activeClients: activeClients.count ?? 0,
      activeProjects: activeProjects.count ?? 0,
      dueToday: dueToday.count ?? 0,
      overdue: overdue.count ?? 0,
      newLeads: newLeads.count ?? 0,
      newApplicants: newApplicants.count ?? 0,
    },
    team,
    weeklyCapacityHours: (editors.data ?? []).reduce((sum, editor) => sum + (editor.weekly_hours ?? 0), 0),
    dueTasks,
    activity: (activity.data ?? []).map<ActivityItem>((item) => ({
      id: item.id,
      summary: item.summary,
      action: item.action,
      createdAt: item.created_at,
      actorName: item.actor?.full_name ?? null,
      actorAvatar: item.actor?.avatar_url ?? null,
    })),
    applicants: applicants.data ?? [],
    hours,
    completed,
  };
}

// -----------------------------------------------------------------------------
// Editor ("My day")
// -----------------------------------------------------------------------------
export async function getEditorDashboard(user: CurrentUser) {
  const supabase = await createClient();
  const timeZone = user.timezone;
  const today = todayIn(timeZone);
  const now = Date.now();

  const [editor, tasks, checklist, announcement, hours, completed] = await Promise.all([
    supabase
      .from("editors")
      .select(
        `work_status, status_since, weekly_hours, onboarding_completed_at,
         task:tasks!editors_current_task_fkey(title, project:projects(name)),
         shift:shifts!editors_current_shift_fkey(clock_in_at)`,
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("id, title, due_date, priority, status, progress_pct, project:projects(name)")
      .eq("assignee_id", user.id)
      .neq("status", "done")
      .order("due_date", { nullsFirst: false })
      .limit(50),
    supabase.from("editor_checklist_items").select("is_done").eq("editor_id", user.id),
    supabase
      .from("announcements")
      .select("id, title, body, created_at, is_pinned")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    hoursHistory(timeZone, today),
    completedByMonth(timeZone),
  ]);

  const weekStart = startOfWeek(today);
  const hoursThisWeek = hours.filter((d) => d.day >= weekStart).reduce((sum, d) => sum + d.seconds, 0);
  const openTasks = tasks.data ?? [];
  const items = checklist.data ?? [];

  return {
    today,
    timeZone,
    renderedAt: now,
    status: {
      workStatus: editor.data?.work_status ?? ("off" as const),
      taskTitle: editor.data?.task?.title ?? null,
      projectName: editor.data?.task?.project?.name ?? null,
      clockInAt: editor.data?.shift?.clock_in_at ?? null,
    },
    kpis: {
      dueToday: openTasks.filter((t) => t.due_date === today).length,
      overdue: openTasks.filter((t) => t.due_date && t.due_date < today).length,
      inReview: openTasks.filter((t) => t.status === "for_review").length,
      hoursThisWeek,
      weeklyHours: editor.data?.weekly_hours ?? null,
    },
    tasks: openTasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.due_date,
      priority: t.priority,
      status: t.status,
      progress: t.progress_pct,
      projectName: t.project?.name ?? "Internal",
    })),
    onboarding: editor.data?.onboarding_completed_at
      ? null
      : { done: items.filter((i) => i.is_done).length, total: items.length },
    announcement: announcement.data,
    hours,
    completed,
  };
}
