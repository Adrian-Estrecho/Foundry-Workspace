"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { blankToNull, fail, fieldErrorsOf, optionalText, type ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function revalidateEditor(id?: string) {
  revalidatePath("/editors");
  if (id) revalidatePath(`/editors/${id}`);
}

const optionalNumber = (schema: z.ZodNumber) => z.preprocess(blankToNull, z.coerce.number().pipe(schema).nullable());
const rateSchema = optionalNumber(z.number().min(0, "Rate can't be negative.").max(1000, "That rate looks too high."));
const hoursSchema = optionalNumber(z.number().int("Use whole hours.").min(0).max(168, "Up to 168 hours a week."));

// -----------------------------------------------------------------------------
// Roster
// (Invitations live in features/invitations.)
// -----------------------------------------------------------------------------

export async function setEditorActive(editorId: string, active: boolean): Promise<ActionResult> {
  await requirePermission("editors.manage");
  if (!z.uuid().safeParse(editorId).success) return fail("Invalid editor.");

  const supabase = await createClient();
  const { error } = await supabase.from("editors").update({ is_active: active }).eq("id", editorId);
  if (error) return fail(error.message);

  revalidateEditor(editorId);
  revalidatePath("/dashboard");
  return { ok: true };
}

const REMOVE_ERRORS: Record<string, string> = {
  not_self: "You can't remove yourself.",
  not_found: "They're not on the team anymore.",
  not_editor: "Only editors can be removed here.",
  still_active: "Mark them inactive first.",
};

/** Takes an inactive editor off the team. Their hours and past work stay. */
export async function removeEditor(editorId: string): Promise<ActionResult> {
  await requirePermission("editors.manage");
  if (!z.uuid().safeParse(editorId).success) return fail("Invalid editor.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_user_id: editorId });
  if (error?.message === "open_tasks") {
    const open = Number(error.details);
    return fail(`Reassign their ${open === 1 ? "open task" : `${open} open tasks`} first.`);
  }
  if (error) return fail(REMOVE_ERRORS[error.message] ?? error.message);

  revalidateEditor(editorId);
  revalidatePath("/people");
  revalidatePath("/dashboard");
  return { ok: true };
}

const detailsSchema = z.object({
  software: z.array(z.string().trim().min(1).max(60)).max(20),
  specialties: z.array(z.string().trim().min(1).max(60)).max(20),
  hourly_rate: rateSchema,
  weekly_hours: hoursSchema,
  work_days: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Pick at least one work day."),
  shift_start: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time."),
});

/** Work details for this workspace. (Timezone and phone are the editor's own, in their settings.) */
export async function updateEditorDetails(editorId: string, formData: FormData): Promise<ActionResult> {
  await requirePermission("editors.manage");
  if (!z.uuid().safeParse(editorId).success) return fail("Invalid editor.");
  const parsed = detailsSchema.safeParse({
    ...Object.fromEntries(formData),
    software: formData.getAll("software"),
    specialties: formData.getAll("specialties"),
    work_days: formData.getAll("work_days"),
  });
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { work_days, ...details } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("editors")
    .update({ ...details, work_days: [...new Set(work_days)].sort((a, b) => a - b) })
    .eq("id", editorId);
  if (error) return fail(error.message);

  revalidateEditor(editorId);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Onboarding (admin side)
// -----------------------------------------------------------------------------

/** Admins can tick or untick any step, e.g. a contract received by email. */
export async function toggleEditorChecklistItem(itemId: string, done: boolean): Promise<ActionResult> {
  await requirePermission("editors.manage");
  if (!z.uuid().safeParse(itemId).success) return fail("Invalid step.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("editor_checklist_items")
    .update({ is_done: done, done_at: done ? new Date().toISOString() : null })
    .eq("id", itemId)
    .select("editor_id")
    .single();
  if (error) return fail(error.message);

  revalidateEditor(data.editor_id);
  return { ok: true };
}

const trialSchema = z.object({
  title: z.string().trim().min(2, "Give the task a title.").max(160),
  description: optionalText(4000),
  due_date: z.preprocess(blankToNull, z.iso.date("Pick a valid date.").nullable()),
});

/** Creates the editor's test edit (a trial task: internal, no client project). */
export async function assignTrialTask(editorId: string, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("editors.manage");
  if (!z.uuid().safeParse(editorId).success) return fail("Invalid editor.");
  const parsed = trialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    ...parsed.data,
    assignee_id: editorId,
    is_trial: true,
    priority: "medium",
    created_by: user.id,
  });
  if (error) return fail(error.message);

  revalidateEditor(editorId);
  return { ok: true };
}

/** Approves the trial task (Done ticks the onboarding step) or sends it back with feedback. */
export async function reviewTrialTask(
  taskId: string,
  decision: "done" | "revisions",
  feedback: string,
): Promise<ActionResult> {
  const user = await requirePermission("editors.manage");
  const parsed = z
    .object({ taskId: z.uuid(), decision: z.enum(["done", "revisions"]), feedback: z.string().trim().max(4000) })
    .safeParse({ taskId, decision, feedback });
  if (!parsed.success) return fail("Invalid review.");
  if (parsed.data.decision === "revisions" && !parsed.data.feedback) return fail("Tell them what to change.");

  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("assignee_id, is_trial").eq("id", taskId).maybeSingle();
  if (!task?.is_trial) return fail("That test edit no longer exists.");

  if (parsed.data.feedback) {
    const { error } = await supabase
      .from("task_comments")
      .insert({ task_id: taskId, author_id: user.id, body: parsed.data.feedback });
    if (error) return fail(error.message);
  }
  const { error } = await supabase.from("tasks").update({ status: parsed.data.decision }).eq("id", taskId);
  if (error) return fail(error.message);

  revalidateEditor(task.assignee_id ?? undefined);
  return { ok: true };
}

export async function deleteTrialTask(taskId: string): Promise<ActionResult> {
  await requirePermission("editors.manage");
  if (!z.uuid().safeParse(taskId).success) return fail("Invalid task.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("is_trial", true)
    .select("assignee_id")
    .maybeSingle();
  if (error) return fail(error.message);

  revalidateEditor(data?.assignee_id ?? undefined);
  return { ok: true };
}
