import "server-only";
import type { StatusColor } from "@/features/statuses/constants";
import type { TaskPriority, TaskStatus } from "@/features/tasks/constants";
import {
  clickup,
  ClickUpError,
  type ClickUpClient,
  type ClickUpStatus,
  type ClickUpTask,
  type ClickUpTaskUpdate,
  type ClickUpUser,
} from "@/lib/clickup";
import { isTimeZone } from "@/lib/action-result";
import { momentIn, todayIn } from "@/lib/dates";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { TablesInsert, TablesUpdate } from "@/types/database";
import { statusLabel } from "./types";

/**
 * The ClickUp → ReEdit sync. Everything here runs as the service role: the
 * database triggers let the sync do what people can't (add tasks to a linked
 * project, change a synced task's project) and don't send its changes back
 * to ClickUp. What people change goes the other way through clickup_outbox
 * (pushQueuedChanges).
 */

type Admin = ReturnType<typeof createAdminClient>;

/** A List's status as a pipeline keeps it: ClickUp's name in lower case, type, order and colour. */
export type ListStatus = { name: string; type: string; orderindex: number; color: string };

export type Pipeline = {
  id: string;
  list_id: string;
  list_name: string;
  project_id: string;
  start_status: string;
  statuses: ListStatus[];
};

export type Connection = { workspaceId: string; teamId: string; timezone: string; api: ClickUpClient };

export const toListStatuses = (statuses: ClickUpStatus[]): ListStatus[] =>
  [...statuses]
    .sort((a, b) => a.orderindex - b.orderindex)
    .map((s) => ({ name: s.status.toLowerCase(), type: s.type, orderindex: s.orderindex, color: s.color }));

/**
 * A first guess at a ClickUp status's stage, from its type (ClickUp's own
 * not started / active / done / closed groups) and, for active ones, its
 * name. The admin confirms it when linking a pipeline.
 */
export function guessStage(status: Pick<ListStatus, "name" | "type">): TaskStatus {
  const name = status.name.toLowerCase();
  if (status.type === "done" || status.type === "closed") return "done";
  if (status.type === "open" || status.type === "unstarted") return "todo";
  if (/review|approval|\bqa\b|check/.test(name)) return "for_review";
  if (/revis|rework|\bfix|feedback|changes/.test(name)) return "revisions";
  if (/post|publish|schedul|deliver|complete|\bdone\b|\blive\b/.test(name)) return "done";
  if (/ready|to ?do|waiting|pause|hold|backlog|queue|idea|not started|blocked/.test(name)) return "todo";
  return "in_progress";
}

/** The workspace colour nearest a ClickUp status colour (#rrggbb). */
export function colorKeyFor(color: string | null | undefined): StatusColor {
  const match = /^#?([0-9a-f]{6})$/i.exec(color?.trim() ?? "");
  if (!match) return "grey";
  const n = parseInt(match[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0 || delta / (1 - Math.abs(2 * lightness - 1)) < 0.18) return "grey";
  const sector = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  const hue = (sector * 60 + 360) % 360;
  if (hue < 15 || hue >= 345) return "red";
  if (hue < 40) return "orange";
  if (hue < 65) return "yellow";
  if (hue < 160) return "green";
  if (hue < 195) return "teal";
  if (hue < 250) return "blue";
  if (hue < 290) return "purple";
  return "pink";
}

/** Whether a task in this ClickUp status has reached the pipeline's start status. */
export function reachedStart(pipeline: Pick<Pipeline, "statuses" | "start_status">, status: string) {
  const order = (name: string) => pipeline.statuses.find((s) => s.name === name)?.orderindex;
  const start = order(pipeline.start_status);
  const at = order(status);
  return start === undefined || at === undefined || at >= start;
}

export const errorMessage = (error: unknown) =>
  error instanceof ClickUpError || error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String((error as { message: unknown }).message)
      : "Something went wrong.";

// -----------------------------------------------------------------------------
// Connection
// -----------------------------------------------------------------------------
export async function loadConnection(admin: Admin, workspaceId: string): Promise<Connection | null> {
  const [{ data: connection }, { data: secret }] = await Promise.all([
    admin.from("clickup_connections").select("team_id, timezone").eq("workspace_id", workspaceId).maybeSingle(),
    admin.from("clickup_secrets").select("api_token").eq("workspace_id", workspaceId).maybeSingle(),
  ]);
  if (!connection || !secret) return null;
  return { workspaceId, teamId: connection.team_id, timezone: connection.timezone, api: clickup(secret.api_token) };
}

/** Shown on the ClickUp page until the next successful sync clears it. */
export async function recordError(admin: Admin, workspaceId: string, message: string | null) {
  await admin
    .from("clickup_connections")
    .update(message ? { last_error: message.slice(0, 500), last_error_at: new Date().toISOString() } : { last_error: null, last_error_at: null })
    .eq("workspace_id", workspaceId);
}

// -----------------------------------------------------------------------------
// Statuses
// -----------------------------------------------------------------------------
type StatusRow = { id: string; name: string; stage: TaskStatus; position: number };

/** Right after `after` and before whatever follows it; after everything when there's nothing to follow. */
function positionAfter(sorted: StatusRow[], after: string | null) {
  const last = sorted.at(-1)?.position ?? 0;
  const index = after ? sorted.findIndex((s) => s.id === after) : -1;
  if (index === -1) return last + 1;
  const next = sorted[index + 1];
  return next ? (sorted[index].position + next.position) / 2 : sorted[index].position + 1;
}

/**
 * Gives each of a List's statuses a workspace status: one already linked to
 * that ClickUp name, one with the same name, or a new one in the given stage
 * (or the guessed one), placed after the status before it in ClickUp's order.
 * Returns ClickUp name → workspace status id.
 */
export async function ensureStatuses(
  admin: Admin,
  workspaceId: string,
  listStatuses: ListStatus[],
  { stages = {}, needsReview = false }: { stages?: Partial<Record<string, TaskStatus>>; needsReview?: boolean } = {},
) {
  const [{ data: rows, error }, { data: links }] = await Promise.all([
    admin
      .from("task_statuses")
      .select("id, name, stage, position")
      .eq("workspace_id", workspaceId)
      .order("position")
      .order("created_at"),
    admin.from("clickup_status_map").select("clickup_status, status_id").eq("workspace_id", workspaceId),
  ]);
  if (error) throw error;
  const statuses: StatusRow[] = [...(rows ?? [])];
  const map = new Map((links ?? []).map((link) => [link.clickup_status, link.status_id]));
  const added: { workspace_id: string; clickup_status: string; status_id: string; needs_review: boolean }[] = [];

  let previous: string | null = null;
  for (const status of listStatuses) {
    let id: string | undefined = map.get(status.name);
    if (!id) {
      const label = statusLabel(status.name);
      id = statuses.find((s) => s.name.toLowerCase() === label.toLowerCase())?.id;
      if (!id) {
        const position: number = positionAfter(statuses, previous);
        const { data, error: insertError } = await admin
          .from("task_statuses")
          .insert({
            workspace_id: workspaceId,
            name: label,
            color: colorKeyFor(status.color),
            stage: stages[status.name] ?? guessStage(status),
            position,
          })
          .select("id, name, stage, position")
          .single();
        if (insertError) throw insertError;
        statuses.push(data);
        statuses.sort((a, b) => a.position - b.position);
        id = data.id;
      }
      map.set(status.name, id);
      added.push({ workspace_id: workspaceId, clickup_status: status.name, status_id: id, needs_review: needsReview });
    }
    previous = id;
  }

  if (added.length) {
    const { error: linkError } = await admin.from("clickup_status_map").upsert(added, { onConflict: "workspace_id,clickup_status" });
    if (linkError) throw linkError;
  }
  return map;
}

// -----------------------------------------------------------------------------
// Tasks
// -----------------------------------------------------------------------------
const PRIORITIES: Record<string, TaskPriority> = { urgent: "urgent", high: "high", normal: "medium", low: "low" };

type TaskFields = {
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  assignee_id: string | null;
};

export type SyncContext = {
  admin: Admin;
  connection: Connection;
  /** By ClickUp List id. */
  pipelines: Map<string, Pipeline>;
  /** ClickUp status name → workspace status id. */
  statusIds: Map<string, string>;
  /** Workspace status id → stage. */
  stages: Map<string, TaskStatus>;
  /** Active editors' emails (lower case) → editor id. */
  editors: Map<string, string>;
};

/** Active editors' emails (lower case) → editor id: how ClickUp assignees are matched. */
async function activeEditors(admin: Admin, workspaceId: string) {
  const { data } = await admin
    .from("editors")
    .select("id, profile:profiles!editors_id_fkey(email), member:workspace_members!editors_member_fkey!inner(status)")
    .eq("workspace_id", workspaceId)
    .eq("member.status", "active");
  return new Map((data ?? []).flatMap((e) => (e.profile?.email ? [[e.profile.email.toLowerCase(), e.id] as const] : [])));
}

export async function loadSyncContext(admin: Admin, connection: Connection): Promise<SyncContext> {
  const ws = connection.workspaceId;
  const [pipelines, links, statuses, editors] = await Promise.all([
    admin.from("clickup_pipelines").select("id, list_id, list_name, project_id, start_status, statuses").eq("workspace_id", ws),
    admin.from("clickup_status_map").select("clickup_status, status_id").eq("workspace_id", ws),
    admin.from("task_statuses").select("id, stage").eq("workspace_id", ws),
    activeEditors(admin, ws),
  ]);
  if (pipelines.error) throw pipelines.error;

  return {
    admin,
    connection,
    pipelines: new Map(
      (pipelines.data ?? []).map((p) => [p.list_id, { ...p, statuses: (p.statuses as ListStatus[] | null) ?? [] }]),
    ),
    statusIds: new Map((links.data ?? []).map((l) => [l.clickup_status, l.status_id])),
    stages: new Map((statuses.data ?? []).map((s) => [s.id, s.stage])),
    editors,
  };
}

// -----------------------------------------------------------------------------
// People: ClickUp accounts by email
// -----------------------------------------------------------------------------

/**
 * Remembers ClickUp accounts by email. ClickUp's API can't list guests, so
 * an assignee picked here is looked up among the people the sync has seen.
 */
export async function rememberPeople(admin: Admin, workspaceId: string, users: ClickUpUser[]) {
  const seenAt = new Date().toISOString();
  const rows = new Map<string, TablesInsert<"clickup_people">>();
  for (const user of users) {
    const email = user.email?.trim().toLowerCase();
    if (email && user.id) rows.set(email, { workspace_id: workspaceId, email, clickup_user_id: user.id, name: user.username, seen_at: seenAt });
  }
  if (rows.size) await admin.from("clickup_people").upsert([...rows.values()], { onConflict: "workspace_id,email" });
}

/**
 * The ClickUp user id for an email: from the people the sync has seen or,
 * failing that, the ClickUp workspace's members and the List's members and
 * assignees. Null when nobody in ClickUp has that email.
 */
export async function findClickUpUser(admin: Admin, connection: Connection, listId: string | null, email: string) {
  const { data: known } = await admin
    .from("clickup_people")
    .select("clickup_user_id")
    .eq("workspace_id", connection.workspaceId)
    .eq("email", email)
    .maybeSingle();
  if (known) return known.clickup_user_id;

  const [teams, listMembers] = await Promise.all([connection.api.teams(), listId ? connection.api.listMembers(listId) : []]);
  const people = [...(teams.find((t) => t.id === connection.teamId)?.members ?? []).map((m) => m.user), ...listMembers];
  const match = () => people.find((p) => p.email?.toLowerCase() === email);
  for (let page = 0; listId && !match() && page < 20; page++) {
    const { tasks, last_page } = await connection.api.listTasks(listId, page);
    people.push(...tasks.flatMap((t) => t.assignees));
    if (last_page || tasks.length < 100) break;
  }
  await rememberPeople(admin, connection.workspaceId, people);
  return match()?.id ?? null;
}

/**
 * Why an editor can't take over a synced task, or null when they can (or
 * the task isn't synced). ClickUp has to have someone with their email, or
 * the two would disagree about who has the task. Checked before an admin's
 * change is saved.
 */
export async function clickupAssigneeProblem(admin: Admin, workspaceId: string, taskId: string, editorId: string) {
  const { data: task } = await admin
    .from("tasks")
    .select("clickup_task_id, project_id")
    .eq("workspace_id", workspaceId)
    .eq("id", taskId)
    .maybeSingle();
  if (!task?.clickup_task_id || !task.project_id) return null;

  const [connection, { data: pipeline }, { data: profile }] = await Promise.all([
    loadConnection(admin, workspaceId),
    admin.from("clickup_pipelines").select("list_id").eq("project_id", task.project_id).maybeSingle(),
    admin.from("profiles").select("full_name, email").eq("id", editorId).maybeSingle(),
  ]);
  if (!connection || !pipeline) return null;
  const name = profile?.full_name || "That editor";
  const email = profile?.email?.toLowerCase();
  if (!email) return `${name} has no email to find them in ClickUp by.`;

  try {
    if (await findClickUpUser(admin, connection, pipeline.list_id, email)) return null;
  } catch (error) {
    return `Couldn't check ${name}'s ClickUp account. ${errorMessage(error)}`;
  }
  return `${name} isn't in ClickUp as ${email}, so the task can't go to them there. Add them to ClickUp with that email first.`;
}

/**
 * Fetches a List's statuses from ClickUp, saves them on the pipeline and
 * gives new ones a workspace status (flagged for an admin to check).
 */
export async function refreshPipelineStatuses(ctx: SyncContext, pipeline: Pipeline) {
  const list = await ctx.connection.api.list(pipeline.list_id);
  const statuses = toListStatuses(list.statuses);
  const ids = await ensureStatuses(ctx.admin, ctx.connection.workspaceId, statuses, { needsReview: true });
  await ctx.admin.from("clickup_pipelines").update({ statuses, list_name: list.name }).eq("id", pipeline.id);

  pipeline.statuses = statuses;
  pipeline.list_name = list.name;
  for (const [name, id] of ids) ctx.statusIds.set(name, id);
  const { data } = await ctx.admin.from("task_statuses").select("id, stage").eq("workspace_id", ctx.connection.workspaceId);
  for (const status of data ?? []) ctx.stages.set(status.id, status.stage);
}

function fieldsFrom(task: ClickUpTask, ctx: SyncContext): TaskFields {
  const due = task.due_date ? Number(task.due_date) : NaN;
  return {
    title: task.name.trim().slice(0, 200) || "Untitled task",
    description: task.text_content?.trim().slice(0, 20_000) || null,
    due_date: Number.isFinite(due) ? todayIn(ctx.connection.timezone, new Date(due)) : null,
    priority: PRIORITIES[task.priority?.priority ?? ""] ?? "medium",
    assignee_id: task.assignees.map((a) => ctx.editors.get(a.email?.toLowerCase() ?? "")).find(Boolean) ?? null,
  };
}

async function endOfColumn(admin: Admin, workspaceId: string, statusId: string) {
  const { data } = await admin
    .from("tasks")
    .select("position")
    .eq("workspace_id", workspaceId)
    .eq("status_id", statusId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

/** Deletes tasks with their files. Logged time stays in the timesheets, unlinked. */
export async function removeTasks(admin: Admin, ids: string[]) {
  if (ids.length === 0) return;
  const { data: files } = await admin.from("task_attachments").select("storage_path").in("task_id", ids).eq("kind", "file");
  const { error } = await admin.from("tasks").delete().in("id", ids);
  if (error) throw error;
  const paths = (files ?? []).map((f) => f.storage_path).filter((p): p is string => Boolean(p));
  if (paths.length) await admin.storage.from("task-files").remove(paths);
}

export type SyncResult = "created" | "updated" | "unchanged" | "removed" | "skipped";

/**
 * Brings one ClickUp task into ReEdit: creates it once it has reached its
 * pipeline's start status, keeps it up to date after that, and removes it
 * when it's archived or leaves the linked Lists. Subtasks aren't synced, and
 * a task that's already finished (a Done-stage status) isn't brought in; one
 * that finishes after it's here stays. A change made in ReEdit that hasn't
 * reached ClickUp yet wins over ClickUp's value for that field.
 */
export async function syncTask(ctx: SyncContext, task: ClickUpTask): Promise<SyncResult> {
  const { admin } = ctx;
  const ws = ctx.connection.workspaceId;
  const { data: existing, error } = await admin
    .from("tasks")
    .select("id, project_id, title, description, due_date, priority, assignee_id, status_id")
    .eq("workspace_id", ws)
    .eq("clickup_task_id", task.id)
    .maybeSingle();
  if (error) throw error;

  const pipeline = task.archived || task.parent ? undefined : ctx.pipelines.get(task.list.id);
  if (!pipeline) {
    if (!existing) return "skipped";
    await removeTasks(admin, [existing.id]);
    return "removed";
  }

  const statusName = task.status.status.toLowerCase();
  if (!ctx.statusIds.has(statusName) || !pipeline.statuses.some((s) => s.name === statusName)) {
    await refreshPipelineStatuses(ctx, pipeline);
  }
  const statusId = ctx.statusIds.get(statusName);
  if (!statusId) throw new Error(`ClickUp's "${task.status.status}" status couldn't be matched to one here.`);
  const fields = fieldsFrom(task, ctx);

  if (!existing) {
    if (!reachedStart(pipeline, statusName)) return "skipped";
    if (ctx.stages.get(statusId) === "done") return "skipped";
    const { error: insertError } = await admin.from("tasks").insert({
      ...fields,
      workspace_id: ws,
      project_id: pipeline.project_id,
      clickup_task_id: task.id,
      status_id: statusId,
      position: await endOfColumn(admin, ws, statusId),
    });
    // Another event for the same task got there first.
    if (insertError?.code === "23505") return syncTask(ctx, task);
    if (insertError) throw insertError;
    return "created";
  }

  const changes: TablesUpdate<"tasks"> = {};
  const keys = Object.keys(fields) as (keyof TaskFields)[];
  for (const key of keys) {
    if (fields[key] !== existing[key]) Object.assign(changes, { [key]: fields[key] });
  }
  if (existing.project_id !== pipeline.project_id) changes.project_id = pipeline.project_id;
  const moved = existing.status_id !== statusId;
  if (!moved && Object.keys(changes).length === 0) return "unchanged";

  const { data: waiting } = await admin.from("clickup_outbox").select("fields").eq("task_id", existing.id).maybeSingle();
  const pending = new Set(waiting?.fields);
  for (const key of keys) if (pending.has(key)) delete changes[key];
  if (moved && !pending.has("status")) {
    changes.status_id = statusId;
    changes.position = await endOfColumn(admin, ws, statusId);
  }
  if (Object.keys(changes).length === 0) return "unchanged";

  const { error: updateError } = await admin.from("tasks").update(changes).eq("id", existing.id);
  if (updateError) throw updateError;
  return "updated";
}

export type ImportCounts = Record<SyncResult, number>;

/**
 * Pulls a whole List. After the first import it also looks up tasks that
 * are no longer in the List (deleted, archived or moved), which syncTask
 * then removes or moves.
 */
export async function importPipeline(ctx: SyncContext, pipeline: Pipeline, { initial = false } = {}) {
  const counts: ImportCounts = { created: 0, updated: 0, unchanged: 0, removed: 0, skipped: 0 };
  const seen = new Set<string>();
  const people: ClickUpUser[] = [];

  for (let page = 0; page < 200; page++) {
    const { tasks, last_page } = await ctx.connection.api.listTasks(pipeline.list_id, page);
    for (const task of tasks) {
      seen.add(task.id);
      people.push(...task.assignees);
      counts[await syncTask(ctx, task)]++;
    }
    if (last_page || tasks.length < 100) break;
  }
  await rememberPeople(ctx.admin, ctx.connection.workspaceId, people);

  if (!initial) {
    const { data } = await ctx.admin
      .from("tasks")
      .select("id, clickup_task_id")
      .eq("project_id", pipeline.project_id)
      .not("clickup_task_id", "is", null);
    for (const gone of (data ?? []).filter((t) => !seen.has(t.clickup_task_id!))) {
      try {
        counts[await syncTask(ctx, await ctx.connection.api.task(gone.clickup_task_id!))]++;
      } catch (error) {
        if (!(error instanceof ClickUpError) || (error.status !== 404 && error.status !== 401)) throw error;
        await removeTasks(ctx.admin, [gone.id]);
        counts.removed++;
      }
    }
  }

  await ctx.admin.from("clickup_pipelines").update({ last_synced_at: new Date().toISOString() }).eq("id", pipeline.id);
  return counts;
}

// -----------------------------------------------------------------------------
// ClickUp → ReEdit: webhook events
// -----------------------------------------------------------------------------
export type WebhookPayload = { event?: string; webhook_id?: string; task_id?: string; list_id?: string | number };

/** Applies one webhook event. The task is always fetched fresh, so late or repeated events do no harm. */
export async function handleWebhook(ctx: SyncContext, payload: WebhookPayload) {
  const { admin } = ctx;
  if (ctx.pipelines.size === 0) return;

  if (payload.event === "listUpdated") {
    const pipeline = ctx.pipelines.get(String(payload.list_id ?? ""));
    if (pipeline) await refreshPipelineStatuses(ctx, pipeline);
    return;
  }
  if (!payload.task_id) return;

  const removeLinked = async () => {
    const { data } = await admin
      .from("tasks")
      .select("id")
      .eq("workspace_id", ctx.connection.workspaceId)
      .eq("clickup_task_id", payload.task_id!)
      .maybeSingle();
    if (data) await removeTasks(admin, [data.id]);
  };

  if (payload.event === "taskDeleted") return removeLinked();
  try {
    const task = await ctx.connection.api.task(payload.task_id);
    await rememberPeople(admin, ctx.connection.workspaceId, task.assignees);
    await syncTask(ctx, task);
  } catch (error) {
    if (error instanceof ClickUpError && error.status === 404) return removeLinked();
    throw error;
  }
}

// -----------------------------------------------------------------------------
// ReEdit → ClickUp: queued changes
// -----------------------------------------------------------------------------
const MAX_ATTEMPTS = 8;
const CLICKUP_PRIORITIES: Record<TaskPriority, number> = { urgent: 1, high: 2, medium: 3, low: 4 };
/** ClickUp keeps a due date without a time at 4:00 in the morning, in the time zone of whoever set it. */
const DATE_ONLY_MINUTES = 4 * 60;

/** A row of due_clickup_pushes: which fields changed, and the task as it is now. */
type QueuedChange = {
  task_id: string;
  workspace_id: string;
  revision: number;
  attempts: number;
  fields: string[];
  clickup_task_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  assignee_email: string | null;
  list_id: string | null;
  list_name: string | null;
  clickup_status: string | null;
};

/** A workspace's connection during one push run, with what's looked up once. */
type PushTarget = { connection: Connection; editors?: Map<string, string>; accountZone?: string };

/**
 * A due date from here as ClickUp keeps a date without a time: 4:00 in the
 * morning in the ClickUp account's time zone, as if they'd set it there. A
 * time set in ClickUp is dropped (ReEdit has none). The moment has to read
 * back as the same date here, or noon here is used.
 */
async function dueDateUpdate(target: PushTarget, date: string | null): Promise<ClickUpTaskUpdate> {
  if (!date) return { due_date: null, due_date_time: false };
  const here = target.connection.timezone;
  if (!target.accountZone) {
    const zone = (await target.connection.api.user()).timezone;
    target.accountZone = zone && isTimeZone(zone) ? zone : here;
  }
  const dateOnly = momentIn(date, DATE_ONLY_MINUTES, target.accountZone);
  const readsBack = todayIn(here, new Date(dateOnly)) === date;
  return { due_date: readsBack ? dateOnly : momentIn(date, 12 * 60, here), due_date_time: false };
}

/**
 * Who to add and remove in ClickUp so the task's editor there is the one
 * picked here. A ClickUp task can have several assignees: the ones who are
 * editors here make way, and anyone else (an owner, someone not in ReEdit)
 * stays. A string says why it can't be done.
 */
async function assigneesUpdate(admin: Admin, target: PushTarget, change: QueuedChange, current: ClickUpTask) {
  target.editors ??= await activeEditors(admin, change.workspace_id);
  const editors = target.editors;
  const email = change.assignee_email;
  const rem = current.assignees
    .filter((a) => {
      const assignee = a.email?.toLowerCase();
      return assignee && assignee !== email && editors.has(assignee);
    })
    .map((a) => a.id);
  const add: number[] = [];
  if (email && !current.assignees.some((a) => a.email?.toLowerCase() === email)) {
    const id = await findClickUpUser(admin, target.connection, change.list_id, email);
    if (!id) return `${change.title} wasn't reassigned in ClickUp: nobody there has the email ${email}.`;
    add.push(id);
  }
  return add.length || rem.length ? { add, rem } : null;
}

/** The ClickUp update for a queued change. What can't be sent is left out and explained in `problems`. */
async function clickupUpdate(admin: Admin, target: PushTarget, change: QueuedChange & { clickup_task_id: string }) {
  const fields = new Set(change.fields);
  const update: ClickUpTaskUpdate = {};
  const problems: string[] = [];

  if (fields.has("title")) update.name = change.title;
  // Plain text, as ReEdit keeps it. ClickUp clears a description set to a space.
  if (fields.has("description")) update.description = change.description?.replace(/\r\n?/g, "\n").trim() || " ";
  if (fields.has("priority")) update.priority = CLICKUP_PRIORITIES[change.priority];
  if (fields.has("status")) {
    if (change.clickup_status) update.status = change.clickup_status;
    else problems.push(`${change.title} couldn't move in ClickUp: ${change.list_name ?? "its list"} doesn't have that status.`);
  }

  if (fields.has("due_date")) Object.assign(update, await dueDateUpdate(target, change.due_date));
  if (fields.has("assignee_id")) {
    const current = await target.connection.api.task(change.clickup_task_id);
    await rememberPeople(admin, change.workspace_id, current.assignees);
    const assignees = await assigneesUpdate(admin, target, change, current);
    if (typeof assignees === "string") problems.push(assignees);
    else if (assignees) update.assignees = assignees;
  }
  return { update, problems };
}

/**
 * Sends waiting changes to ClickUp, with each task's values as they are now.
 * A change that fails is retried with a growing wait (the database asks
 * again every minute); after 8 tries it's dropped and the error shows on the
 * ClickUp page, as does a part that couldn't be sent (a status the List
 * doesn't have, an assignee ClickUp doesn't know).
 */
export async function pushQueuedChanges(admin: Admin) {
  const { data, error } = await admin.rpc("due_clickup_pushes", { p_limit: 50 });
  if (error) throw error;
  const changes = (data ?? []) as QueuedChange[];

  const targets = new Map<string, PushTarget | null>();
  let pushed = 0;
  for (const change of changes) {
    if (!targets.has(change.workspace_id)) {
      const connection = await loadConnection(admin, change.workspace_id);
      targets.set(change.workspace_id, connection && { connection });
    }
    const target = targets.get(change.workspace_id);
    // Only the change this run read: a newer one stays queued.
    const row = { task_id: change.task_id, revision: change.revision };
    const done = () => admin.from("clickup_outbox").delete().match(row);

    const taskId = change.clickup_task_id;
    if (!target || !taskId) {
      await done();
      continue;
    }

    try {
      const { update, problems } = await clickupUpdate(admin, target, { ...change, clickup_task_id: taskId });
      if (Object.keys(update).length) await target.connection.api.updateTask(taskId, update);
      await done();
      pushed++;
      if (problems.length) await recordError(admin, change.workspace_id, problems.join(" "));
    } catch (pushError) {
      const attempts = change.attempts + 1;
      const message = `${change.title} couldn't be updated in ClickUp. ${errorMessage(pushError)}`;
      if (attempts >= MAX_ATTEMPTS || (pushError instanceof ClickUpError && pushError.status === 404)) {
        await done();
        await recordError(admin, change.workspace_id, message);
      } else {
        await admin
          .from("clickup_outbox")
          .update({ attempts, last_error: message, next_attempt_at: new Date(Date.now() + attempts * attempts * 60_000).toISOString() })
          .match(row);
      }
    }
  }
  return { pushed, waiting: changes.length - pushed };
}
