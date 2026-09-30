import "server-only";
import { notFound } from "next/navigation";
import type { StatusBadge, StatusColor } from "@/features/statuses/constants";
import { getTaskStatuses } from "@/features/statuses/queries";
import { workspaceAdmins } from "@/features/workspaces/queries";
import type { CurrentUser } from "@/lib/auth";
import { clickupTaskUrl } from "@/lib/clickup";
import { addDays, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/utils";
import { taskAccess } from "./access";
import { monthGrid } from "./calendar";
import { RECENT_DONE_DAYS, TASK_STAGES, taskStageLabel, type TaskPriority, type TaskStatus } from "./constants";
import type { TaskFilters } from "./filters";

export type Person = { id: string; name: string; avatarUrl: string | null };

/** What boards, lists and calendars need to draw a task. */
export type TaskSummary = {
  id: string;
  title: string;
  /** The stage, which decides the rules (Done, review, what editors may do). */
  status: TaskStatus;
  /** The workspace's own status the task is in. */
  statusInfo: StatusBadge;
  priority: TaskPriority;
  dueDate: string | null;
  position: number;
  progress: number;
  revisionCount: number;
  isTrial: boolean;
  completedAt: string | null;
  assignee: Person | null;
  project: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  subtasks: { done: number; total: number };
  comments: number;
  attachments: number;
  /** Set when the task is synced from ClickUp, which owns what the task is. */
  clickupUrl: string | null;
};

/** `clickup`: the project is fed by a ClickUp List, so its tasks are added there. */
export type ProjectOption = { id: string; name: string; clientId: string; clientName: string; delivered: boolean; clickup: boolean };
export type EditorChoice = Person & { isActive: boolean };
export type TaskFormOptions = { projects: ProjectOption[]; editors: EditorChoice[] };

const TASK_FIELDS = `id, title, status, priority, due_date, position, progress_pct, revision_count, is_trial, completed_at, clickup_task_id,
  assignee:editors!tasks_assignee_id_fkey(id, profile:profiles!editors_id_fkey(full_name, avatar_url)),
  project:projects(id, name, client_id),
  subtasks(is_done),
  comments:task_comments(count),
  attachments:task_attachments(count),
  status_info:task_statuses!tasks_status_id_fkey(id, name, color)`;

const NO_MATCH = "00000000-0000-0000-0000-000000000000";

const isStage = (value: string): value is TaskStatus => TASK_STAGES.some((stage) => stage.value === value);

/**
 * Client names by id. Goes through client_directory, which editors can read
 * for their own projects (they can't see client contact details).
 */
async function clientNames(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.from("client_directory").select("id, company, contact_name").in("id", unique);
  return new Map(
    (data ?? []).filter((c) => c.id).map((c) => [c.id!, c.company?.trim() || c.contact_name || "Client"] as const),
  );
}

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  position: number;
  progress_pct: number;
  revision_count: number;
  is_trial: boolean;
  completed_at: string | null;
  clickup_task_id: string | null;
  assignee: { id: string; profile: { full_name: string; avatar_url: string | null } | null } | null;
  project: { id: string; name: string; client_id: string } | null;
  subtasks: { is_done: boolean }[];
  comments: { count: number }[];
  attachments: { count: number }[];
  status_info: RawStatus | RawStatus[] | null;
};

type RawStatus = { id: string; name: string; color: string };

/** The task's status, for chips. Falls back to the stage if it can't be read. */
const toStatusBadge = (raw: RawStatus | RawStatus[] | null, stage: TaskStatus): StatusBadge => {
  const status = one(raw);
  return status
    ? { id: status.id, name: status.name, color: status.color as StatusColor }
    : { id: stage, name: taskStageLabel(stage), color: "grey" };
};

async function toSummaries(rows: TaskRow[]): Promise<TaskSummary[]> {
  const clients = await clientNames(rows.map((row) => row.project?.client_id));
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    statusInfo: toStatusBadge(row.status_info, row.status),
    priority: row.priority,
    dueDate: row.due_date,
    position: row.position,
    progress: row.progress_pct,
    revisionCount: row.revision_count,
    isTrial: row.is_trial,
    completedAt: row.completed_at,
    assignee: row.assignee
      ? { id: row.assignee.id, name: row.assignee.profile?.full_name ?? "Editor", avatarUrl: row.assignee.profile?.avatar_url ?? null }
      : null,
    project: row.project ? { id: row.project.id, name: row.project.name } : null,
    client: row.project ? { id: row.project.client_id, name: clients.get(row.project.client_id) ?? "Client" } : null,
    subtasks: { done: row.subtasks.filter((s) => s.is_done).length, total: row.subtasks.length },
    comments: row.comments[0]?.count ?? 0,
    attachments: row.attachments[0]?.count ?? 0,
    clickupUrl: row.clickup_task_id ? clickupTaskUrl(row.clickup_task_id) : null,
  }));
}

/** Projects (newest deadline first, delivered last) and editors, for task forms and filters. */
export async function getTaskFormOptions(): Promise<TaskFormOptions> {
  const supabase = await createClient();
  const [{ data: projects }, { data: editors }, { data: pipelines }] = await Promise.all([
    supabase.from("projects").select("id, name, status, client_id, created_at").order("created_at", { ascending: false }),
    // Approved editors only: people still onboarding can't be given work.
    supabase
      .from("editors")
      .select("id, is_active, profile:profiles!editors_id_fkey(full_name, avatar_url), member:workspace_members!editors_member_fkey!inner(status)")
      .eq("member.status", "active"),
    // Admins only (RLS); editors don't get task forms.
    supabase.from("clickup_pipelines").select("project_id"),
  ]);
  const clients = await clientNames((projects ?? []).map((p) => p.client_id));
  const linked = new Set((pipelines ?? []).map((p) => p.project_id));

  return {
    projects: (projects ?? [])
      .map((p) => ({
        id: p.id,
        name: p.name,
        clientId: p.client_id,
        clientName: clients.get(p.client_id) ?? "Client",
        delivered: p.status === "delivered",
        clickup: linked.has(p.id),
      }))
      .sort((a, b) => Number(a.delivered) - Number(b.delivered) || a.clientName.localeCompare(b.clientName) || a.name.localeCompare(b.name)),
    editors: (editors ?? [])
      .map((e) => ({
        id: e.id,
        name: e.profile?.full_name ?? "Editor",
        avatarUrl: e.profile?.avatar_url ?? null,
        isActive: e.is_active,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// -----------------------------------------------------------------------------
// /tasks (admin)
// -----------------------------------------------------------------------------
export async function getTasksPage(user: CurrentUser, filters: TaskFilters) {
  const supabase = await createClient();
  const today = todayIn(user.timezone);
  const month = filters.month ?? today.slice(0, 7);
  const grid = monthGrid(month);

  let clientProjectIds: string[] | null = null;
  if (filters.client) {
    const { data } = await supabase.from("projects").select("id").eq("client_id", filters.client);
    clientProjectIds = (data ?? []).map((p) => p.id);
  }

  let query = supabase.from("tasks").select(TASK_FIELDS).order("position").limit(1000);

  if (filters.editor === "none") query = query.is("assignee_id", null);
  else if (filters.editor) query = query.eq("assignee_id", filters.editor);
  if (filters.project) query = query.eq("project_id", filters.project);
  if (clientProjectIds) query = query.in("project_id", clientProjectIds.length ? clientProjectIds : [NO_MATCH]);
  if (filters.status) query = isStage(filters.status) ? query.eq("status", filters.status) : query.eq("status_id", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.q) query = query.ilike("title", `%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);

  if (filters.due === "overdue") query = query.lt("due_date", today).neq("status", "done");
  else if (filters.due === "today") query = query.eq("due_date", today);
  else if (filters.due === "week") query = query.gte("due_date", today).lte("due_date", addDays(today, 6));
  else if (filters.due === "none") query = query.is("due_date", null);

  if (filters.view === "calendar") {
    query = query.gte("due_date", grid.start).lte("due_date", grid.end);
  } else if (filters.view === "editors") {
    // Workload means open work.
    if (!filters.status) query = query.neq("status", "done");
  } else if (!filters.status) {
    const since = new Date(Date.now() - RECENT_DONE_DAYS * 86_400_000).toISOString();
    query = query.or(`status.neq.done,completed_at.gte."${since}"`);
  }

  const count = { count: "exact" as const, head: true };
  const [{ data, error }, options, statuses, open, overdue, forReview] = await Promise.all([
    query,
    getTaskFormOptions(),
    getTaskStatuses(),
    supabase.from("tasks").select("id", count).neq("status", "done"),
    supabase.from("tasks").select("id", count).lt("due_date", today).neq("status", "done"),
    supabase.from("tasks").select("id", count).eq("status", "for_review"),
  ]);
  if (error) throw error;

  return {
    tasks: await toSummaries(data ?? []),
    options,
    statuses,
    today,
    month,
    counts: { open: open.count ?? 0, overdue: overdue.count ?? 0, forReview: forReview.count ?? 0 },
  };
}

// -----------------------------------------------------------------------------
// /my-tasks (editor)
// -----------------------------------------------------------------------------
export async function getMyTasks(user: CurrentUser) {
  const supabase = await createClient();
  const since = new Date(Date.now() - RECENT_DONE_DAYS * 86_400_000).toISOString();
  const [{ data, error }, statuses] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_FIELDS)
      .eq("assignee_id", user.id)
      .or(`status.neq.done,completed_at.gte."${since}"`)
      .order("position")
      .limit(500),
    getTaskStatuses(),
  ]);
  if (error) throw error;
  return { tasks: await toSummaries(data ?? []), statuses, today: todayIn(user.timezone) };
}

/** Tasks in one project (editors get only their own, through RLS). */
export async function getProjectTasks(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select(TASK_FIELDS).eq("project_id", projectId).order("position");
  if (error) throw error;
  return toSummaries(data ?? []);
}

// -----------------------------------------------------------------------------
// /tasks/[id]
// -----------------------------------------------------------------------------
export async function getTaskDetail(id: string, user: CurrentUser) {
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select(
      `*,
       assignee:editors!tasks_assignee_id_fkey(id, is_active, profile:profiles!editors_id_fkey(full_name, avatar_url)),
       project:projects(id, name, client_id, status, drive_folder_url, frameio_url),
       creator:profiles!tasks_created_by_fkey(full_name),
       subtasks(*),
       attachments:task_attachments(*, adder:profiles(full_name)),
       comments:task_comments(*, author:profiles(id, full_name, avatar_url)),
       status_info:task_statuses!tasks_status_id_fkey(id, name, color)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!task) notFound();
  const access = taskAccess(user, { trial: task.is_trial });
  // Test edits' history is filed under tasks, which hiring can't read.
  const showHistory = user.role === "admin" || (!task.is_trial && access.manage);

  const [clients, admins, time, activity, options, statuses] = await Promise.all([
    clientNames([task.project?.client_id]),
    workspaceAdmins(supabase, user.workspace.id),
    supabase.rpc("task_time", { p_task_id: id }),
    showHistory
      ? supabase
          .from("activity_log")
          .select("id, summary, created_at, actor:profiles(full_name, avatar_url)")
          .eq("entity_id", id)
          .order("created_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
    access.manage ? getTaskFormOptions() : Promise.resolve(null),
    getTaskStatuses(),
  ]);

  // Files are private: hand out short-lived links.
  const attachments = await Promise.all(
    [...task.attachments]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(async (a) => {
        let href = a.url;
        if (a.kind === "file" && a.storage_path) {
          const { data } = await supabase.storage.from("task-files").createSignedUrl(a.storage_path, 60 * 60);
          href = data?.signedUrl ?? null;
        }
        return {
          id: a.id,
          kind: a.kind as "link" | "file",
          href,
          label: a.label,
          addedBy: a.added_by,
          addedByName: a.adder?.full_name ?? null,
          createdAt: a.created_at,
        };
      }),
  );

  const assignee: Person | null = task.assignee
    ? { id: task.assignee.id, name: task.assignee.profile?.full_name ?? "Editor", avatarUrl: task.assignee.profile?.avatar_url ?? null }
    : null;

  // Who can be @mentioned: people who can open this task.
  const people: Person[] = [
    ...admins.map((a) => ({ id: a.id, name: a.full_name, avatarUrl: a.avatar_url })),
    ...(assignee && !admins.some((a) => a.id === assignee.id) ? [assignee] : []),
  ];
  const adminIds = new Set(admins.map((a) => a.id));

  const names = new Map(people.map((p) => [p.id, p.name]));
  for (const comment of task.comments) if (comment.author) names.set(comment.author.id, comment.author.full_name);
  // Time can include editors who had the task before it was reassigned.
  const unnamed = (time.data ?? []).map((row) => row.editor_id).filter((editorId) => !names.has(editorId));
  if (unnamed.length) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", unnamed);
    for (const profile of data ?? []) names.set(profile.id, profile.full_name);
  }

  return {
    task,
    showHistory,
    statusInfo: toStatusBadge(task.status_info, task.status),
    statuses,
    assignee,
    assigneeActive: task.assignee?.is_active ?? true,
    project: task.project,
    client: task.project ? { id: task.project.client_id, name: clients.get(task.project.client_id) ?? "Client" } : null,
    creatorName: task.creator?.full_name ?? null,
    subtasks: [...task.subtasks].sort((a, b) => a.position - b.position),
    attachments,
    comments: [...task.comments]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.created_at,
        mentions: c.mentions,
        author: c.author ? { id: c.author.id, name: c.author.full_name, avatarUrl: c.author.avatar_url, isAdmin: adminIds.has(c.author.id) } : null,
      })),
    people,
    time: (time.data ?? [])
      .map((row) => ({ editorId: row.editor_id, name: names.get(row.editor_id) ?? "Editor", seconds: Number(row.seconds) }))
      .sort((a, b) => b.seconds - a.seconds),
    activity: activity.data ?? [],
    options,
    today: todayIn(user.timezone),
    renderedAt: Date.now(),
  };
}

export type TaskDetail = Awaited<ReturnType<typeof getTaskDetail>>;
