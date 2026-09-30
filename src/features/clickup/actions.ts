"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TASK_STAGES, type TaskStatus } from "@/features/tasks/constants";
import { fail, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { clickup, ClickUpError } from "@/lib/clickup";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  colorKeyFor,
  ensureStatuses,
  errorMessage,
  guessStage,
  importPipeline,
  loadConnection,
  loadSyncContext,
  recordError,
  refreshPipelineStatuses,
  toListStatuses,
  type ImportCounts,
} from "./sync";
import { statusLabel, type ClickUpTree, type ListSetup } from "./types";

/**
 * Connecting ClickUp and linking its Lists (pipelines) to projects. Owners
 * and admins only. ClickUp-side work and the tables people can't write (the
 * token, synced tasks) go through the service role after requireAdmin.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

const STAGE_VALUES = TASK_STAGES.map((s) => s.value) as [TaskStatus, ...TaskStatus[]];

/** ClickUp can only call an address on the internet. */
const webhookUrl = () =>
  /^https:\/\//.test(env.siteUrl) && !/localhost|127\.0\.0\.1/.test(env.siteUrl) ? `${env.siteUrl.replace(/\/$/, "")}/api/webhooks/clickup` : null;

function revalidateClickUp(projectId?: string) {
  revalidatePath("/workspace/clickup");
  revalidatePath("/workspace");
  revalidatePath("/tasks");
  revalidatePath("/projects");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

/** The connection as the current admin's workspace has it, or a message to show. */
async function connected() {
  const user = await requireAdmin();
  const admin = createAdminClient();
  const connection = await loadConnection(admin, user.workspace.id);
  return { user, admin, connection };
}

// -----------------------------------------------------------------------------
// Connect and disconnect
// -----------------------------------------------------------------------------

/**
 * Checks the token, remembers it and registers the webhook that brings
 * ClickUp's changes in. A token with access to several ClickUp workspaces
 * first returns them to pick from.
 */
export async function connectClickUp(formData: FormData): Promise<ActionResult<{ teams?: { id: string; name: string }[] }>> {
  const user = await requireAdmin();
  const parsed = z
    .object({
      token: z.string().trim().min(20, "Paste your ClickUp API token.").max(200).startsWith("pk_", "Personal API tokens start with pk_."),
      team_id: z.string().trim().max(40).optional(),
    })
    .safeParse({ token: formData.get("token"), team_id: formData.get("team_id") || undefined });
  if (!parsed.success) return fail("Check the token.", { token: parsed.error.issues[0]?.message ?? "Check the token." });
  const { token, team_id } = parsed.data;

  const api = clickup(token);
  let account, teams;
  try {
    [account, teams] = await Promise.all([api.user(), api.teams()]);
  } catch (error) {
    if (error instanceof ClickUpError && (error.status === 401 || error.status === 400)) {
      return fail("ClickUp didn't accept that token.", { token: "ClickUp didn't accept this token. Copy it again from ClickUp → Settings → Apps." });
    }
    return fail(`Couldn't reach ClickUp. ${errorMessage(error)}`);
  }
  if (teams.length === 0) return fail("That token can't see any ClickUp workspace.");
  const team = teams.length === 1 ? teams[0] : teams.find((t) => t.id === team_id);
  if (!team) return { ok: true, data: { teams: teams.map((t) => ({ id: t.id, name: t.name })) } };

  const admin = createAdminClient();
  const ws = user.workspace.id;
  const [{ data: current }, { data: currentSecret }] = await Promise.all([
    admin.from("clickup_connections").select("team_id, webhook_id").eq("workspace_id", ws).maybeSingle(),
    admin.from("clickup_secrets").select("api_token").eq("workspace_id", ws).maybeSingle(),
  ]);
  if (current && current.team_id !== team.id) {
    return fail("This workspace is linked to another ClickUp workspace. Disconnect it first.");
  }

  let webhook: { id: string; secret: string | null } | null = null;
  const endpoint = webhookUrl();
  if (endpoint) {
    try {
      const created = await api.createWebhook(team.id, endpoint);
      webhook = { id: created.id, secret: created.webhook.secret ?? null };
    } catch (error) {
      return fail(`ClickUp accepted the token but not the webhook. ${errorMessage(error)}`);
    }
    if (current?.webhook_id && currentSecret) {
      await clickup(currentSecret.api_token).deleteWebhook(current.webhook_id).catch(() => undefined);
    }
  }

  const { error } = await admin.from("clickup_connections").upsert({
    workspace_id: ws,
    team_id: team.id,
    team_name: team.name,
    account_name: account.username || account.email || "ClickUp user",
    account_email: account.email,
    webhook_id: webhook?.id ?? null,
    timezone: user.timezone,
    connected_by: user.id,
    connected_at: new Date().toISOString(),
    last_error: null,
    last_error_at: null,
  });
  if (error) return fail(error.message);
  const { error: secretError } = await admin
    .from("clickup_secrets")
    .upsert({ workspace_id: ws, api_token: token, webhook_secret: webhook?.secret ?? null });
  if (secretError) return fail(secretError.message);

  revalidateClickUp();
  return { ok: true, data: {} };
}

/**
 * Stops syncing: removes the webhook and the links. Synced tasks stay as
 * ordinary ReEdit tasks, and the statuses stay as they are.
 */
export async function disconnectClickUp(): Promise<ActionResult> {
  const { user, admin, connection } = await connected();
  const ws = user.workspace.id;
  const { data: row } = await admin.from("clickup_connections").select("webhook_id").eq("workspace_id", ws).maybeSingle();
  if (connection && row?.webhook_id) await connection.api.deleteWebhook(row.webhook_id).catch(() => undefined);

  const { error } = await admin.from("tasks").update({ clickup_task_id: null }).eq("workspace_id", ws).not("clickup_task_id", "is", null);
  if (error) return fail(error.message);
  await admin.from("clickup_outbox").delete().eq("workspace_id", ws);
  const { error: deleteError } = await admin.from("clickup_connections").delete().eq("workspace_id", ws);
  if (deleteError) return fail(deleteError.message);

  revalidateClickUp();
  return { ok: true };
}

export async function dismissClickUpError(): Promise<ActionResult> {
  const user = await requireAdmin();
  await recordError(createAdminClient(), user.workspace.id, null);
  revalidatePath("/workspace/clickup");
  return { ok: true };
}

/** An admin has looked at statuses the sync added on its own. */
export async function confirmClickUpStatuses(): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("clickup_status_map").update({ needs_review: false }).eq("needs_review", true);
  if (error) return fail(error.message);
  revalidatePath("/workspace/clickup");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Picking and linking a List
// -----------------------------------------------------------------------------

/** Spaces, folders and Lists the token can see, for the picker. */
export async function browseClickUp(): Promise<ActionResult<ClickUpTree>> {
  const { admin, connection, user } = await connected();
  if (!connection) return fail("Connect ClickUp first.");
  try {
    const [spaces, { data: pipelines }] = await Promise.all([
      connection.api.spaces(connection.teamId),
      admin.from("clickup_pipelines").select("list_id, project:projects(name)").eq("workspace_id", user.workspace.id),
    ]);
    const linked = new Map((pipelines ?? []).map((p) => [p.list_id, p.project?.name ?? "a project"]));
    const toNode = (list: { id: string; name: string; task_count?: number | null }) => ({
      id: list.id,
      name: list.name,
      taskCount: list.task_count ?? null,
      linkedTo: linked.get(list.id) ?? null,
    });

    const tree = await Promise.all(
      spaces.map(async (space) => {
        const [folders, lists] = await Promise.all([connection.api.folders(space.id), connection.api.folderlessLists(space.id)]);
        return {
          id: space.id,
          name: space.name,
          folders: folders.map((folder) => ({ id: folder.id, name: folder.name, lists: folder.lists.map(toNode) })),
          lists: lists.map(toNode),
        };
      }),
    );
    return { ok: true, data: { spaces: tree } };
  } catch (error) {
    return fail(`Couldn't load your ClickUp Lists. ${errorMessage(error)}`);
  }
}

/** A List's statuses with the stage each would get, for the link form. */
export async function getListSetup(listId: string): Promise<ActionResult<ListSetup>> {
  const { connection } = await connected();
  if (!connection) return fail("Connect ClickUp first.");
  if (!/^\w{1,40}$/.test(listId)) return fail("Invalid List.");

  let list;
  try {
    list = await connection.api.list(listId);
  } catch (error) {
    return fail(`Couldn't load that List. ${errorMessage(error)}`);
  }

  const supabase = await createClient();
  const [{ data: links }, { data: statuses }] = await Promise.all([
    supabase.from("clickup_status_map").select("clickup_status, status_id"),
    supabase.from("task_statuses").select("id, name, stage"),
  ]);
  const byId = new Map((statuses ?? []).map((s) => [s.id, s]));
  const linkedTo = new Map((links ?? []).map((l) => [l.clickup_status, byId.get(l.status_id)]));
  const listStatuses = toListStatuses(list.statuses);

  const rows = listStatuses.map((status) => {
    const existing =
      linkedTo.get(status.name) ?? (statuses ?? []).find((s) => s.name.toLowerCase() === statusLabel(status.name).toLowerCase());
    return {
      name: status.name,
      label: statusLabel(status.name),
      type: status.type,
      color: colorKeyFor(status.color),
      stage: existing?.stage ?? guessStage(status),
      fixed: Boolean(existing),
    };
  });
  const usedIds = new Set([...(links ?? []).map((l) => l.status_id)]);
  const others = (statuses ?? []).filter(
    (s) => !usedIds.has(s.id) && !listStatuses.some((l) => statusLabel(l.name).toLowerCase() === s.name.toLowerCase()),
  );

  return { ok: true, data: { list: { id: list.id, name: list.name }, statuses: rows, otherStatuses: others.map((s) => s.name) } };
}

/**
 * Removes the workspace statuses that don't come from ClickUp, moving their
 * tasks to the first ClickUp status of the same stage. A stage with no
 * ClickUp status keeps its own.
 */
async function replaceOtherStatuses(supabase: Supabase, keep: Set<string>) {
  const { data } = await supabase.from("task_statuses").select("id, stage").order("position").order("created_at");
  const rows = data ?? [];
  for (const status of rows.filter((s) => !keep.has(s.id))) {
    const target = rows.find((s) => keep.has(s.id) && s.stage === status.stage);
    if (!target) continue;
    const { error } = await supabase.rpc("delete_task_status", { p_status_id: status.id, p_move_to: target.id });
    if (error) throw error;
  }
}

const linkSchema = z
  .object({
    list_id: z.string().regex(/^\w{1,40}$/, "Pick a List."),
    project: z.union([z.literal("new"), z.uuid("Pick a project.")]),
    project_name: z.string().trim().max(120).optional(),
    client: z.union([z.literal("new"), z.uuid("Pick a client.")]).optional(),
    client_name: z.string().trim().max(120).optional(),
    start_status: z.string().trim().min(1, "Pick where syncing starts.").max(100),
    replace: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.project !== "new") return;
    if (!value.project_name) ctx.addIssue({ code: "custom", path: ["project_name"], message: "Name the project." });
    if (!value.client) ctx.addIssue({ code: "custom", path: ["client"], message: "Pick a client." });
    if (value.client === "new" && !value.client_name) ctx.addIssue({ code: "custom", path: ["client_name"], message: "Name the client." });
  });

/**
 * Links a List to a project (a new one, or an existing one), copies its
 * statuses in (optionally replacing the workspace's own), then imports the
 * tasks that have reached the start status.
 */
export async function linkPipeline(formData: FormData): Promise<ActionResult<{ projectId: string; counts: ImportCounts }>> {
  const { user, admin, connection } = await connected();
  if (!connection) return fail("Connect ClickUp first.");
  const parsed = linkSchema.safeParse({
    list_id: formData.get("list_id"),
    project: formData.get("project"),
    project_name: formData.get("project_name") || undefined,
    client: formData.get("client") || undefined,
    client_name: formData.get("client_name") || undefined,
    start_status: formData.get("start_status"),
    replace: formData.get("replace") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return fail("Check the highlighted fields.", fieldErrors);
  }
  const input = parsed.data;
  const ws = user.workspace.id;

  let list;
  try {
    list = await connection.api.list(input.list_id);
  } catch (error) {
    return fail(`Couldn't load that List. ${errorMessage(error)}`);
  }
  const statuses = toListStatuses(list.statuses);
  const start = input.start_status.toLowerCase();
  if (!statuses.some((s) => s.name === start)) return fail("That status isn't in the List any more.", { start_status: "Pick again." });

  const stages: Partial<Record<string, TaskStatus>> = {};
  for (const status of statuses) {
    const stage = z.enum(STAGE_VALUES).safeParse(formData.get(`stage:${status.name}`));
    if (stage.success) stages[status.name] = stage.data;
  }

  const { data: taken } = await admin
    .from("clickup_pipelines")
    .select("list_id, project_id")
    .eq("workspace_id", ws)
    .or(`list_id.eq.${input.list_id}${input.project !== "new" ? `,project_id.eq.${input.project}` : ""}`);
  if (taken?.some((p) => p.list_id === input.list_id)) return fail(`${list.name} is already linked.`);
  if (taken?.length) return fail("That project already has a ClickUp List.", { project: "Pick another project." });

  const supabase = await createClient();
  let projectId: string;
  if (input.project === "new") {
    let clientId = input.client!;
    if (clientId === "new") {
      const { data: client, error } = await supabase
        .from("clients")
        .insert({ contact_name: input.client_name!, company: input.client_name!, stage: "active_client" })
        .select("id")
        .single();
      if (error) return fail(error.message);
      clientId = client.id;
    }
    const { data: project, error } = await supabase
      .from("projects")
      .insert({ client_id: clientId, name: input.project_name!, created_by: user.id })
      .select("id")
      .single();
    if (error) return fail(error.message);
    projectId = project.id;
  } else {
    const { data: project } = await supabase.from("projects").select("id").eq("id", input.project).maybeSingle();
    if (!project) return fail("That project no longer exists.", { project: "Pick another project." });
    projectId = project.id;
  }

  try {
    await ensureStatuses(admin, ws, statuses, { stages });
    if (input.replace) {
      const { data: links } = await admin.from("clickup_status_map").select("status_id").eq("workspace_id", ws);
      await replaceOtherStatuses(supabase, new Set((links ?? []).map((l) => l.status_id)));
    }
    const { error } = await admin.from("clickup_pipelines").insert({
      workspace_id: ws,
      list_id: list.id,
      list_name: list.name,
      project_id: projectId,
      start_status: start,
      statuses,
      created_by: user.id,
    });
    if (error) throw error;

    const ctx = await loadSyncContext(admin, connection);
    const counts = await importPipeline(ctx, ctx.pipelines.get(list.id)!, { initial: true });
    revalidateClickUp(projectId);
    revalidatePath("/", "layout");
    return { ok: true, data: { projectId, counts } };
  } catch (error) {
    revalidateClickUp(projectId);
    return fail(`The List was linked only partly: ${errorMessage(error)} Try Sync now on the ClickUp page.`);
  }
}

// -----------------------------------------------------------------------------
// Linked pipelines
// -----------------------------------------------------------------------------
async function pipelineFor(pipelineId: string) {
  const { user, admin, connection } = await connected();
  if (!z.uuid().safeParse(pipelineId).success) return { error: "Invalid pipeline." } as const;
  const { data } = await admin
    .from("clickup_pipelines")
    .select("id, list_id, list_name, project_id, start_status, statuses")
    .eq("workspace_id", user.workspace.id)
    .eq("id", pipelineId)
    .maybeSingle();
  if (!data) return { error: "That pipeline is no longer linked." } as const;
  return { user, admin, connection, pipeline: data };
}

/** Pulls the whole List again: new, changed and removed tasks, and new statuses. */
export async function syncPipelineNow(pipelineId: string): Promise<ActionResult<ImportCounts>> {
  const found = await pipelineFor(pipelineId);
  if ("error" in found) return fail(found.error!);
  const { admin, connection, pipeline, user } = found;
  if (!connection) return fail("Connect ClickUp first.");

  try {
    const ctx = await loadSyncContext(admin, connection);
    const linked = ctx.pipelines.get(pipeline.list_id)!;
    await refreshPipelineStatuses(ctx, linked);
    const counts = await importPipeline(ctx, linked);
    await recordError(admin, user.workspace.id, null);
    revalidateClickUp(pipeline.project_id);
    return { ok: true, data: counts };
  } catch (error) {
    await recordError(admin, user.workspace.id, `Syncing ${pipeline.list_name} failed: ${errorMessage(error)}`);
    revalidateClickUp(pipeline.project_id);
    return fail(`Couldn't sync ${pipeline.list_name}. ${errorMessage(error)}`);
  }
}

/** Where syncing starts. Tasks already here stay; ones that now qualify come in. */
export async function setPipelineStart(pipelineId: string, startStatus: string): Promise<ActionResult<ImportCounts>> {
  const found = await pipelineFor(pipelineId);
  if ("error" in found) return fail(found.error!);
  const { admin, pipeline } = found;
  const statuses = (pipeline.statuses as { name: string }[] | null) ?? [];
  const start = startStatus.toLowerCase();
  if (!statuses.some((s) => s.name === start)) return fail("That status isn't in the List.");

  const { error } = await admin.from("clickup_pipelines").update({ start_status: start }).eq("id", pipeline.id);
  if (error) return fail(error.message);
  return syncPipelineNow(pipeline.id);
}

/** Stops syncing one List. Its tasks stay in the project as ordinary ReEdit tasks. */
export async function unlinkPipeline(pipelineId: string): Promise<ActionResult> {
  const found = await pipelineFor(pipelineId);
  if ("error" in found) return fail(found.error!);
  const { admin, pipeline, user } = found;

  const { data: tasks } = await admin
    .from("tasks")
    .select("id")
    .eq("project_id", pipeline.project_id)
    .not("clickup_task_id", "is", null);
  const ids = (tasks ?? []).map((t) => t.id);
  if (ids.length) {
    await admin.from("clickup_outbox").delete().in("task_id", ids);
    const { error } = await admin.from("tasks").update({ clickup_task_id: null }).in("id", ids);
    if (error) return fail(error.message);
  }
  const { error } = await admin.from("clickup_pipelines").delete().eq("id", pipeline.id).eq("workspace_id", user.workspace.id);
  if (error) return fail(error.message);

  revalidateClickUp(pipeline.project_id);
  return { ok: true };
}
