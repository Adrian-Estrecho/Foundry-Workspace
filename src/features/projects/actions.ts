"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, fieldErrorsOf } from "@/lib/action-result";
import { requirePermission } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ProjectActionResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const text = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());
const link = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.url({ protocol: /^https?$/, error: "Enter a full link starting with https://" }).nullable(),
);

// Status isn't part of the form: it changes only through setProjectStatus, so
// a form opened earlier can't put back an old status.
const projectSchema = z.object({
  client_id: z.uuid("Choose the client."),
  name: z.string().trim().min(2, "Give the project a name.").max(160),
  deadline: z.preprocess((v) => (v === "" ? null : v), z.iso.date().nullable()),
  drive_folder_url: link,
  frameio_url: link,
  spec_format: text(80),
  spec_aspect_ratio: text(80),
  spec_length: text(80),
  spec_notes: text(2000),
  editor_ids: z.array(z.uuid()).max(20),
});

function parseProject(formData: FormData) {
  return projectSchema.safeParse({
    ...Object.fromEntries(formData),
    editor_ids: formData.getAll("editor_ids"),
  });
}

function revalidateProject(id?: string, clientId?: string) {
  revalidatePath("/projects");
  revalidatePath("/clients", "layout");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/projects/${id}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

/** Creates a project for a client and assigns its editors. */
export async function createProject(formData: FormData): Promise<ProjectActionResult> {
  const user = await requirePermission("tasks.manage");
  const parsed = parseProject(formData);
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error));

  const { editor_ids, ...project } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...project, created_by: user.id })
    .select("id")
    .single();
  if (error) return fail(error.message);

  if (editor_ids.length) {
    const { error: assignError } = await supabase
      .from("project_editors")
      .insert(editor_ids.map((editor_id) => ({ project_id: data.id, editor_id })));
    if (assignError) return fail(`Project created, but assigning editors failed: ${assignError.message}`);
  }

  revalidateProject(data.id, project.client_id);
  return { ok: true, projectId: data.id };
}

/**
 * Saves the project and applies the team changes made in the form. Only
 * editors unticked in the form are removed, so someone who joined while it
 * was open (e.g. through a new task) stays on the team.
 */
export async function updateProject(id: string, formData: FormData): Promise<ProjectActionResult> {
  await requirePermission("tasks.manage");
  if (!z.uuid().safeParse(id).success) return fail("Invalid project.");
  const parsed = parseProject(formData);
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error));
  const teamBefore = z.array(z.uuid()).safeParse(formData.getAll("team_before"));
  if (!teamBefore.success) return fail("Invalid team.");

  const { editor_ids, ...project } = parsed.data;
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("projects")
    .select("client_id, project_editors(editor_id)")
    .eq("id", id)
    .maybeSingle();
  if (!before) return fail("That project no longer exists.");

  const { error } = await supabase.from("projects").update(project).eq("id", id);
  if (error) return fail(error.message);

  const current = before.project_editors.map((pe) => pe.editor_id);
  const added = editor_ids.filter((editorId) => !current.includes(editorId));
  const removed = current.filter((editorId) => teamBefore.data.includes(editorId) && !editor_ids.includes(editorId));
  if (added.length) {
    const { error: addError } = await supabase
      .from("project_editors")
      .insert(added.map((editor_id) => ({ project_id: id, editor_id })));
    if (addError) return fail(`Saved, but adding editors failed: ${addError.message}`);
  }
  if (removed.length) {
    const { error: removeError } = await supabase.from("project_editors").delete().eq("project_id", id).in("editor_id", removed);
    if (removeError) return fail(`Saved, but removing editors failed: ${removeError.message}`);
  }

  revalidateProject(id, project.client_id);
  if (before.client_id !== project.client_id) revalidatePath(`/clients/${before.client_id}`);
  return { ok: true, projectId: id };
}

/** Moves the project to one of the workspace's project statuses (the stage follows). */
export async function setProjectStatus(id: string, statusId: string): Promise<ProjectActionResult> {
  await requirePermission("tasks.manage");
  const parsed = z.object({ id: z.uuid(), statusId: z.uuid() }).safeParse({ id, statusId });
  if (!parsed.success) return fail("Invalid status.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ status_id: parsed.data.statusId })
    .eq("id", id)
    .select("client_id")
    .maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail("That project no longer exists.");

  revalidateProject(id, data.client_id);
  return { ok: true, projectId: id };
}

/** Deletes a project with its tasks (and their files). Logged time stays, unlinked. */
export async function deleteProject(id: string): Promise<ProjectActionResult> {
  await requirePermission("tasks.manage");
  if (!z.uuid().safeParse(id).success) return fail("Invalid project.");

  const supabase = await createClient();
  const { data: files } = await supabase
    .from("task_attachments")
    .select("storage_path, task:tasks!inner(project_id)")
    .eq("kind", "file")
    .eq("task.project_id", id);

  const { data, error } = await supabase.from("projects").delete().eq("id", id).select("client_id").maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail("That project no longer exists.");

  // Storage policies only reach files of tasks that still exist, so the
  // cleanup runs as the service role, on paths this person could read above.
  const paths = (files ?? []).map((f) => f.storage_path).filter((p): p is string => Boolean(p));
  if (paths.length) await createAdminClient().storage.from("task-files").remove(paths);

  revalidateProject(undefined, data.client_id);
  return { ok: true, projectId: id };
}
