import "server-only";
import type { StatusColor } from "@/features/statuses/constants";
import type { TaskPriority, TaskStatus } from "@/features/tasks/constants";
import { clickup, ClickUpError, type ClickUpClient, type ClickUpStatus, type ClickUpTask } from "@/lib/clickup";
import { todayIn } from "@/lib/dates";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/types/database";
import { statusLabel } from "./types";

/**
 * The ClickUp → ReEdit sync. Everything here runs as the service role: the
 * database triggers let the sync change what people can't (a synced task's
 * title, assignee, due date…) and don't send its status changes back to
 * ClickUp. People's status moves go the other way through clickup_outbox
 * (pushQueuedMoves).
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

export async function loadSyncContext(admin: Admin, connection: Connection): Promise<SyncContext> {
  const ws = connection.workspaceId;
  const [pipelines, links, statuses, editors] = await Promise.all([
    admin.from("clickup_pipelines").select("id, list_id, list_name, project_id, start_status, statuses").eq("workspace_id", ws),
    admin.from("clickup_status_map").select("clickup_status, status_id").eq("workspace_id", ws),
    admin.from("task_statuses").select("id, stage").eq("workspace_id", ws),
    admin
      .from("editors")
      .select("id, profile:profiles!editors_id_fkey(email), member:workspace_members!editors_member_fkey!inner(status)")
      .eq("workspace_id", ws)
      .eq("member.status", "active"),
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
    editors: new Map(
      (editors.data ?? []).flatMap((e) => (e.profile?.email ? [[e.profile.email.toLowerCase(), e.id] as const] : [])),
    ),
  };
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
 * that finishes after it's here stays. A status move made in ReEdit that
 * hasn't reached ClickUp yet wins over ClickUp's status.
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
  for (const key of Object.keys(fields) as (keyof TaskFields)[]) {
    if (fields[key] !== existing[key]) Object.assign(changes, { [key]: fields[key] });
  }
  if (existing.project_id !== pipeline.project_id) changes.project_id = pipeline.project_id;
  if (existing.status_id !== statusId) {
    const { count } = await admin.from("clickup_outbox").select("task_id", { count: "exact", head: true }).eq("task_id", existing.id);
    if (!count) {
      changes.status_id = statusId;
      changes.position = await endOfColumn(admin, ws, statusId);
    }
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

  for (let page = 0; page < 200; page++) {
    const { tasks, last_page } = await ctx.connection.api.listTasks(pipeline.list_id, page);
    for (const task of tasks) {
      seen.add(task.id);
      counts[await syncTask(ctx, task)]++;
    }
    if (last_page || tasks.length < 100) break;
  }

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
    await syncTask(ctx, await ctx.connection.api.task(payload.task_id));
  } catch (error) {
    if (error instanceof ClickUpError && error.status === 404) return removeLinked();
    throw error;
  }
}

// -----------------------------------------------------------------------------
// ReEdit → ClickUp: queued status moves
// -----------------------------------------------------------------------------
const MAX_ATTEMPTS = 8;

/**
 * Sends waiting status moves to ClickUp. A move that fails is retried with a
 * growing wait (the database asks again every minute); after 8 tries it's
 * dropped and the error shows on the ClickUp page.
 */
export async function pushQueuedMoves(admin: Admin) {
  const { data: moves, error } = await admin.rpc("due_clickup_pushes", { p_limit: 50 });
  if (error) throw error;

  const connections = new Map<string, Connection | null>();
  let pushed = 0;
  for (const move of moves ?? []) {
    if (!connections.has(move.workspace_id)) connections.set(move.workspace_id, await loadConnection(admin, move.workspace_id));
    const connection = connections.get(move.workspace_id);
    const drop = () => admin.from("clickup_outbox").delete().match({ task_id: move.task_id, status_id: move.status_id });

    if (!connection) {
      await drop();
      continue;
    }
    if (!move.clickup_status) {
      await drop();
      await recordError(admin, move.workspace_id, `${move.title} couldn't move in ClickUp: ${move.list_name ?? "its list"} doesn't have that status.`);
      continue;
    }

    try {
      await connection.api.setTaskStatus(move.clickup_task_id, move.clickup_status);
      await drop();
      pushed++;
    } catch (pushError) {
      const attempts = move.attempts + 1;
      const message = `${move.title} couldn't move to ${move.clickup_status} in ClickUp. ${errorMessage(pushError)}`;
      if (attempts >= MAX_ATTEMPTS || (pushError instanceof ClickUpError && pushError.status === 404)) {
        await drop();
        await recordError(admin, move.workspace_id, message);
      } else {
        await admin
          .from("clickup_outbox")
          .update({ attempts, last_error: message, next_attempt_at: new Date(Date.now() + attempts * attempts * 60_000).toISOString() })
          .match({ task_id: move.task_id, status_id: move.status_id });
      }
    }
  }
  return { pushed, waiting: (moves?.length ?? 0) - pushed };
}
