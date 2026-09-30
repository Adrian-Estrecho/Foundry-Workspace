"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { workspaceAdmins } from "@/features/workspaces/queries";
import { blankToNull, fail, fieldErrorsOf, optionalText, type ActionResult } from "@/lib/action-result";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Constants } from "@/types/database";

/**
 * Task actions. Admins can do everything. Editors act on their own tasks:
 * RLS limits them to tasks assigned to them, and the guard_task_changes
 * trigger limits what they can change (statuses up to the For Review stage,
 * progress). Tasks move by status_id, one of the workspace's statuses; the
 * trigger keeps the stage (tasks.status) in step.
 */

const prioritySchema = z.enum(Constants.public.Enums.task_priority);
const idSchema = z.uuid();

function revalidateTask(id?: string, projectId?: string | null) {
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  if (id) revalidatePath(`/tasks/${id}`);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

/** Database errors in words people can act on. Trigger messages are already written for users. */
function dbError(error: { code?: string; message: string }) {
  if (error.code === "42501") return error.message;
  if (error.code === "23503") return "Something this refers to no longer exists. Refresh and try again.";
  return error.message;
}

/** Position at the end of a status column (or of a whole stage). */
async function endOfColumn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  column: { status_id: string } | { status: "done" | "revisions" },
) {
  const { data } = await supabase
    .from("tasks")
    .select("position")
    .match(column)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

// -----------------------------------------------------------------------------
// Create, edit, delete (admin)
// -----------------------------------------------------------------------------
const taskSchema = z.object({
  title: z.string().trim().min(2, "Give the task a title.").max(200),
  description: optionalText(8000),
  project_id: z.preprocess(blankToNull, z.uuid().nullable()),
  assignee_id: z.preprocess(blankToNull, z.uuid().nullable()),
  due_date: z.preprocess(blankToNull, z.iso.date("Pick a valid date.").nullable()),
  priority: prioritySchema,
  status_id: z.uuid("Pick a status."),
});

export async function createTask(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireAdmin();
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error));
  const subtasks = String(formData.get("subtasks") ?? "")
    .split("\n")
    .map((line) => line.replace(/^[-*•\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((line) => line.slice(0, 200));

  const supabase = await createClient();
  const position = await endOfColumn(supabase, { status_id: parsed.data.status_id });
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...parsed.data, position, created_by: user.id })
    .select("id")
    .single();
  if (error) return fail(dbError(error));

  if (subtasks.length) {
    const { error: subtaskError } = await supabase
      .from("subtasks")
      .insert(subtasks.map((title, index) => ({ task_id: data.id, title, position: index + 1 })));
    if (subtaskError) return fail(`Task created, but its subtasks weren't saved: ${subtaskError.message}`);
  }

  revalidateTask(data.id, parsed.data.project_id);
  return { ok: true, data: { id: data.id } };
}

/**
 * Saves the task's details. Status isn't part of the edit form: editors move
 * tasks while it may be open, and saving must not put back an old status.
 */
export async function updateTask(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Invalid task.");
  const parsed = taskSchema.omit({ status_id: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { data: before } = await supabase.from("tasks").select("project_id").eq("id", id).maybeSingle();
  if (!before) return fail("That task no longer exists.");

  const { error } = await supabase.from("tasks").update(parsed.data).eq("id", id);
  if (error) return fail(dbError(error));

  revalidateTask(id, parsed.data.project_id);
  if (before.project_id !== parsed.data.project_id) revalidateTask(undefined, before.project_id);
  return { ok: true };
}

/** Deletes a task with its subtasks, comments and files. Logged time stays (unlinked). */
export async function deleteTask(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Invalid task.");

  const supabase = await createClient();
  const { data: files } = await supabase.from("task_attachments").select("storage_path").eq("task_id", id).eq("kind", "file");
  const { data, error } = await supabase.from("tasks").delete().eq("id", id).select("project_id").maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("That task no longer exists.");

  // Storage policies only reach files of tasks that still exist, so the
  // cleanup runs as the service role, on paths this admin could read above.
  const paths = (files ?? []).map((f) => f.storage_path).filter((p): p is string => Boolean(p));
  if (paths.length) await createAdminClient().storage.from("task-files").remove(paths);

  revalidateTask(id, data.project_id);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Status, order, assignment, dates
// -----------------------------------------------------------------------------

/**
 * Moves a task to one of the workspace's statuses: a board drop (with the
 * order in the column) or a status menu (null position: end of the column).
 * Moving into Revisions can carry feedback, which is posted as a comment
 * first so the editor's notification includes it.
 */
export async function moveTask(id: string, statusId: string, position: number | null, feedback?: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z
    .object({
      id: idSchema,
      statusId: idSchema,
      position: z.number().finite().nullable(),
      feedback: z.string().trim().max(4000).optional(),
    })
    .safeParse({ id, statusId, position, feedback });
  if (!parsed.success) return fail("Invalid move.");

  const supabase = await createClient();
  if (parsed.data.feedback) {
    const { error } = await supabase.from("task_comments").insert({ task_id: id, author_id: user.id, body: parsed.data.feedback });
    if (error) return fail(dbError(error));
  }
  const at = parsed.data.position ?? (await endOfColumn(supabase, { status_id: parsed.data.statusId }));
  const { data, error } = await supabase
    .from("tasks")
    .update({ status_id: parsed.data.statusId, position: at })
    .eq("id", id)
    .select("project_id")
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("You can't change this task.");

  revalidateTask(id, data.project_id);
  return { ok: true };
}

/**
 * An admin's review of work handed in: approve (Done) or send back with
 * feedback. The task goes to the first status of that stage.
 */
export async function reviewTask(id: string, decision: "done" | "revisions", feedback: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = z
    .object({ id: idSchema, decision: z.enum(["done", "revisions"]), feedback: z.string().trim().max(4000) })
    .safeParse({ id, decision, feedback });
  if (!parsed.success) return fail("Invalid review.");
  if (parsed.data.decision === "revisions" && !parsed.data.feedback) return fail("Tell them what to change.");

  const supabase = await createClient();
  if (parsed.data.feedback) {
    const { error } = await supabase.from("task_comments").insert({ task_id: id, author_id: user.id, body: parsed.data.feedback });
    if (error) return fail(dbError(error));
  }
  const position = await endOfColumn(supabase, { status: parsed.data.decision });
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: parsed.data.decision, position })
    .eq("id", id)
    .select("project_id, assignee_id")
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("That task no longer exists.");

  revalidateTask(id, data.project_id);
  if (data.assignee_id) revalidatePath(`/editors/${data.assignee_id}`);
  return { ok: true };
}

/** Hands a task to another editor (or nobody). Used by the By Editor view. */
export async function reassignTask(id: string, assigneeId: string | null): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: idSchema, assigneeId: idSchema.nullable() }).safeParse({ id, assigneeId });
  if (!parsed.success) return fail("Invalid assignment.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ assignee_id: parsed.data.assigneeId })
    .eq("id", id)
    .select("project_id")
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("That task no longer exists.");

  revalidateTask(id, data.project_id);
  return { ok: true };
}

/** New due date, e.g. from dragging on the calendar. */
export async function rescheduleTask(id: string, dueDate: string | null): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: idSchema, dueDate: z.iso.date().nullable() }).safeParse({ id, dueDate });
  if (!parsed.success) return fail("Invalid date.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ due_date: parsed.data.dueDate })
    .eq("id", id)
    .select("project_id")
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("That task no longer exists.");

  revalidateTask(id, data.project_id);
  return { ok: true };
}

export async function setTaskProgress(id: string, progress: number): Promise<ActionResult> {
  await requireUser();
  const parsed = z.object({ id: idSchema, progress: z.number().int().min(0).max(100) }).safeParse({ id, progress });
  if (!parsed.success) return fail("Progress is a percentage from 0 to 100.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ progress_pct: parsed.data.progress })
    .eq("id", id)
    .select("project_id")
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("You can't change this task.");

  revalidateTask(id, data.project_id);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Subtasks (admins, and the task's assignee)
// -----------------------------------------------------------------------------
export async function addSubtask(taskId: string, title: string): Promise<ActionResult> {
  await requireUser();
  const parsed = z.object({ taskId: idSchema, title: z.string().trim().min(1, "Type the subtask first.").max(200) }).safeParse({ taskId, title });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid subtask.");

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("subtasks")
    .select("position")
    .eq("task_id", taskId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("subtasks")
    .insert({ task_id: taskId, title: parsed.data.title, position: (last?.position ?? 0) + 1 });
  if (error) return fail(error.code === "42501" ? "You can't change this task." : dbError(error));

  revalidateTask(taskId);
  return { ok: true };
}

export async function toggleSubtask(id: string, done: boolean): Promise<ActionResult> {
  await requireUser();
  if (!idSchema.safeParse(id).success) return fail("Invalid subtask.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("subtasks").update({ is_done: done }).eq("id", id).select("task_id").maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("You can't change this task.");

  revalidateTask(data.task_id);
  return { ok: true };
}

export async function deleteSubtask(id: string): Promise<ActionResult> {
  await requireUser();
  if (!idSchema.safeParse(id).success) return fail("Invalid subtask.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("subtasks").delete().eq("id", id).select("task_id").maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("You can't change this task.");

  revalidateTask(data.task_id);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Links and files
// -----------------------------------------------------------------------------
const linkSchema = z.object({
  url: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.url({ protocol: /^https?$/, error: "Paste the full link (https://…)." }).max(500),
  ),
  label: optionalText(120),
});

export async function addTaskLink(taskId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(taskId).success) return fail("Invalid task.");
  const parsed = linkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the link.", fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_attachments")
    .insert({ task_id: taskId, kind: "link", url: parsed.data.url, label: parsed.data.label, added_by: user.id });
  if (error) return fail(error.code === "42501" ? "You can't change this task." : dbError(error));

  revalidateTask(taskId);
  return { ok: true };
}

/**
 * Records a file the browser already uploaded to task-files/<task_id>/…
 * (uploads go straight to storage so large exports skip the server).
 */
export async function recordTaskFile(taskId: string, path: string, fileName: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z
    .object({ taskId: idSchema, path: z.string().startsWith(`${taskId}/`).max(400), fileName: z.string().trim().min(1).max(200) })
    .safeParse({ taskId, path, fileName });
  if (!parsed.success) return fail("Invalid upload.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_attachments")
    .insert({ task_id: taskId, kind: "file", storage_path: path, label: parsed.data.fileName, added_by: user.id });
  if (error) {
    await supabase.storage.from("task-files").remove([path]);
    return fail(error.code === "42501" ? "You can't change this task." : dbError(error));
  }

  revalidateTask(taskId);
  return { ok: true };
}

export async function removeAttachment(id: string): Promise<ActionResult> {
  await requireUser();
  if (!idSchema.safeParse(id).success) return fail("Invalid attachment.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", id)
    .select("task_id, kind, storage_path")
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("You can only remove links and files you added.");
  if (data.kind === "file" && data.storage_path) await supabase.storage.from("task-files").remove([data.storage_path]);

  revalidateTask(data.task_id);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Comments with @mentions
// -----------------------------------------------------------------------------

/**
 * Posts a comment. Mentions are worked out here from "@Full Name" in the
 * text, limited to people who can open the task (admins and the assignee).
 */
export async function addComment(taskId: string, body: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z
    .object({ taskId: idSchema, body: z.string().trim().min(1, "Write something first.").max(8000) })
    .safeParse({ taskId, body });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid comment.");

  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("assignee_id, project_id").eq("id", taskId).maybeSingle();
  if (!task) return fail("That task no longer exists.");

  const [admins, { data: assignee }] = await Promise.all([
    workspaceAdmins(supabase, user.workspace.id),
    task.assignee_id
      ? supabase.from("profiles").select("id, full_name").eq("id", task.assignee_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const people = assignee ? [...admins, assignee] : admins;
  const text = parsed.data.body.toLowerCase();
  const mentions = people
    .filter((p) => p.id !== user.id && p.full_name && text.includes(`@${p.full_name.toLowerCase()}`))
    .map((p) => p.id);

  const { error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, author_id: user.id, body: parsed.data.body, mentions });
  if (error) return fail(error.code === "42501" ? "You can't comment on this task." : dbError(error));

  revalidateTask(taskId, task.project_id);
  return { ok: true };
}

export async function deleteComment(id: string): Promise<ActionResult> {
  await requireUser();
  if (!idSchema.safeParse(id).success) return fail("Invalid comment.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("task_comments").delete().eq("id", id).select("task_id").maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("You can only delete your own comments.");

  revalidateTask(data.task_id);
  return { ok: true };
}
