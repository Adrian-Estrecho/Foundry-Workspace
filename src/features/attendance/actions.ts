"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { blankToNull, fail, fieldErrorsOf, optionalText, type ActionResult } from "@/lib/action-result";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Starting, pausing and stopping work. Everything goes through the
 * attendance functions in the database (0012_attendance.sql), which check
 * that the task is the editor's and keep shifts, time logs and the live
 * status in step.
 */

const MESSAGES: Record<string, string> = {
  already_working: "You're already working. Switch task or stop first.",
  not_working: "You're not working right now.",
  not_on_break: "You're not on a break.",
  task_unavailable: "That task isn't open for you any more. Pick another one.",
  report_required: "Say what you got done before you stop.",
  report_too_long: "Keep the report under 4,000 characters.",
  invalid_progress: "Progress goes from 0 to 100%.",
  inactive: "Your account is paused in this workspace. Ask an admin.",
  not_found: "We couldn't find that editor.",
};

function attendanceError(error: { code?: string; message: string; details?: string | null }) {
  if (error.message === "working_elsewhere") {
    return `You're still working in ${error.details || "another workspace"}. Stop there first.`;
  }
  if (MESSAGES[error.message]) return MESSAGES[error.message];
  if (error.code === "42501") return error.message;
  return "Something went wrong. Try again.";
}

function revalidateAttendance() {
  revalidatePath("/", "layout");
}

const taskId = z.uuid().nullable();

export async function startWork(task: string | null): Promise<ActionResult> {
  await requireUser();
  const parsed = taskId.safeParse(task);
  if (!parsed.success) return fail("Pick a task from the list.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_work", { p_task_id: parsed.data ?? undefined });
  if (error) return fail(attendanceError(error));
  revalidateAttendance();
  return { ok: true };
}

export async function takeBreak(): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("take_break");
  if (error) return fail(attendanceError(error));
  revalidateAttendance();
  return { ok: true };
}

/** Back to work: on the task from before the break (`task` undefined), another task, or none (null). */
export async function resumeWork(task?: string | null): Promise<ActionResult> {
  await requireUser();
  const parsed = taskId.optional().safeParse(task);
  if (!parsed.success) return fail("Pick a task from the list.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("resume_work", {
    p_task_id: parsed.data ?? undefined,
    p_keep_task: parsed.data === undefined,
  });
  if (error) return fail(attendanceError(error));
  revalidateAttendance();
  return { ok: true };
}

export async function switchTask(task: string | null): Promise<ActionResult> {
  await requireUser();
  const parsed = taskId.safeParse(task);
  if (!parsed.success) return fail("Pick a task from the list.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_task", { p_task_id: parsed.data ?? undefined });
  if (error) return fail(attendanceError(error));
  revalidateAttendance();
  return { ok: true };
}

const stopSchema = z.object({
  work_done: z.string().trim().min(1, "Say what you got done.").max(4000, "Keep it under 4,000 characters."),
  blockers: optionalText(4000),
  // Fields the dialog only shows sometimes (no task picked, a short shift).
  task_id: z.preprocess(blankToNull, z.uuid().nullish()),
  progress: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(100).nullish()),
  ended_at: z.preprocess(blankToNull, z.iso.datetime({ offset: true, error: "Pick a valid time." }).nullish()),
});

/** Stop working and file the end-of-shift report. Returns the seconds worked. */
export async function stopWork(formData: FormData): Promise<ActionResult<{ seconds: number }>> {
  await requireUser();
  const parsed = stopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { work_done, blockers, task_id, progress, ended_at } = parsed.data;
  if (ended_at && new Date(ended_at).getTime() > Date.now() + 60_000) {
    return fail("The end time can't be in the future.", { ended_at: "Pick a time that has passed." });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stop_work", {
    p_work_done: work_done,
    p_blockers: blockers ?? undefined,
    p_task_id: task_id ?? undefined,
    p_progress: task_id && progress != null ? progress : undefined,
    p_ended_at: ended_at ?? undefined,
  });
  if (error) return fail(attendanceError(error));
  revalidateAttendance();
  return { ok: true, data: { seconds: data ?? 0 } };
}

const endShiftSchema = z.object({
  editor_id: z.uuid(),
  ended_at: z.preprocess(blankToNull, z.iso.datetime({ offset: true }).nullable()),
});

/** An admin ends a shift someone left running, now or at an earlier time. */
export async function endShiftFor(input: { editorId: string; endedAt: string | null }): Promise<ActionResult<{ seconds: number }>> {
  await requireAdmin();
  const parsed = endShiftSchema.safeParse({ editor_id: input.editorId, ended_at: input.endedAt });
  if (!parsed.success) return fail("Pick a valid time.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("end_shift_for", {
    p_editor_id: parsed.data.editor_id,
    p_ended_at: parsed.data.ended_at ?? undefined,
  });
  if (error) return fail(attendanceError(error));
  revalidateAttendance();
  return { ok: true, data: { seconds: data ?? 0 } };
}
