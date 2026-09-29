"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, fieldErrorsOf, optionalText, optionalUrl, type ActionResult } from "@/lib/action-result";
import { requireAdmin, type CurrentUser } from "@/lib/auth";
import { renderEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { adminEmailContext, workspaceLink } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";
import { firstName } from "@/lib/utils";

/**
 * The admin side of onboarding: the interview, private notes, and the final
 * decision (full access, or not taken on).
 */

const idSchema = z.uuid();

function revalidateEditor(editorId: string) {
  revalidatePath("/editors");
  revalidatePath(`/editors/${editorId}`);
}

async function editorContact(editorId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name, email, timezone").eq("id", editorId).maybeSingle();
  return data;
}

/** "Thursday, October 2 at 3:30 PM (Asia/Kolkata)" */
function when(iso: string, timeZone: string) {
  const text = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
  return `${text.replace(/, (\d{1,2}:\d{2})/, " at $1")} (${timeZone.replace(/_/g, " ")})`;
}

// -----------------------------------------------------------------------------
// Interview
// -----------------------------------------------------------------------------

const interviewSchema = z.object({
  // Sent by the browser as an ISO timestamp (the picker is in the admin's local time).
  scheduled_at: z.iso.datetime({ offset: true, error: "Pick a date and time." }),
  duration_minutes: z.coerce.number().int().min(5, "At least 5 minutes.").max(240, "Up to 4 hours."),
  meeting_url: optionalUrl("Paste the full meeting link (https://…)."),
  note_to_editor: optionalText(2000),
});

async function emailInterview(user: CurrentUser, editorId: string, interview: z.infer<typeof interviewSchema>, moved: boolean) {
  const editor = await editorContact(editorId);
  if (!editor) return;
  const { recipients, accent, companyName } = await adminEmailContext(user.workspace.id);
  const email = renderEmail({
    accent,
    brand: companyName,
    heading: moved ? "Your interview has moved" : "Your interview is booked",
    intro: `Hi ${firstName(editor.full_name)}, ${moved ? "here's the new time for" : "here are the details of"} your interview with ${companyName}.`,
    rows: [
      ["When", when(interview.scheduled_at, editor.timezone)],
      ["Length", `${interview.duration_minutes} minutes`],
      ["Meeting link", interview.meeting_url],
      ["Note", interview.note_to_editor],
    ],
    cta: { label: "Open your onboarding", url: workspaceLink(env.siteUrl, user.workspace.id, "/onboarding") },
    footnote: "Can't make it? Reply to this email and we'll find another time.",
  });
  await sendEmail({
    to: editor.email,
    subject: `${moved ? "Interview moved" : "Interview booked"}: ${companyName}`,
    replyTo: recipients[0],
    ...email,
  });
}

/** Books an interview (or moves the one already booked) and tells the editor. */
export async function scheduleInterview(editorId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!idSchema.safeParse(editorId).success) return fail("Invalid editor.");
  const parsed = interviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { data: booked } = await supabase
    .from("editor_interviews")
    .select("id")
    .eq("editor_id", editorId)
    .eq("outcome", "scheduled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = booked
    ? await supabase.from("editor_interviews").update(parsed.data).eq("id", booked.id)
    : await supabase.from("editor_interviews").insert({ ...parsed.data, editor_id: editorId });
  if (error) return fail(error.message);

  await emailInterview(user, editorId, parsed.data, Boolean(booked));
  revalidateEditor(editorId);
  return { ok: true };
}

/** Passed ticks the interview step; failed and cancelled just record it. */
export async function setInterviewOutcome(
  interviewId: string,
  outcome: "passed" | "failed" | "cancelled",
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ id: idSchema, outcome: z.enum(["passed", "failed", "cancelled"]) })
    .safeParse({ id: interviewId, outcome });
  if (!parsed.success) return fail("Invalid interview.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("editor_interviews")
    .update({ outcome: parsed.data.outcome, decided_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("editor_id")
    .maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail("That interview no longer exists.");

  revalidateEditor(data.editor_id);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Private notes
// -----------------------------------------------------------------------------

export async function saveEditorNotes(editorId: string, body: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = z.object({ id: idSchema, body: z.string().max(8000, "Notes are too long.") }).safeParse({ id: editorId, body });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid notes.");

  const supabase = await createClient();
  const { error } = await supabase.from("editor_notes").upsert(
    {
      workspace_id: user.workspace.id,
      editor_id: editorId,
      body: parsed.data.body.trim(),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,editor_id" },
  );
  if (error) return fail(error.message);

  revalidatePath(`/editors/${editorId}`);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Final decision
// -----------------------------------------------------------------------------

const DECISION_ERRORS: Record<string, string> = {
  not_onboarding: "They're not waiting for a decision anymore.",
};

/** Full access to the workspace: projects, tasks, attendance, everything. */
export async function approveEditor(editorId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!idSchema.safeParse(editorId).success) return fail("Invalid editor.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_member", { p_user_id: editorId });
  if (error) return fail(DECISION_ERRORS[error.message] ?? error.message);

  const editor = await editorContact(editorId);
  if (editor) {
    const { recipients, accent, companyName } = await adminEmailContext(user.workspace.id);
    const email = renderEmail({
      accent,
      brand: companyName,
      heading: `You're in: welcome to ${companyName}`,
      intro: `Congratulations, ${firstName(editor.full_name)}! You've finished onboarding and ${companyName} has approved you. Your full workspace is open: projects, your tasks, attendance and announcements.`,
      cta: { label: "Open your dashboard", url: workspaceLink(env.siteUrl, user.workspace.id, "/dashboard") },
    });
    await sendEmail({ to: editor.email, subject: `You're in: welcome to ${companyName}`, replyTo: recipients[0], ...email });
  }

  revalidateEditor(editorId);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Not taken on: their access to this workspace ends. Optionally a polite email. */
export async function rejectEditor(editorId: string, notify: boolean): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!idSchema.safeParse(editorId).success) return fail("Invalid editor.");

  const supabase = await createClient();
  const editor = await editorContact(editorId);
  const { error } = await supabase.rpc("reject_member", { p_user_id: editorId });
  if (error) return fail(DECISION_ERRORS[error.message] ?? error.message);

  if (notify && editor) {
    const { recipients, accent, companyName } = await adminEmailContext(user.workspace.id);
    const email = renderEmail({
      accent,
      brand: companyName,
      heading: `Your onboarding with ${companyName}`,
      intro: `Thanks for the time you put into onboarding, ${firstName(editor.full_name)}. We've decided not to move forward right now, so your access to the ${companyName} workspace has ended. We wish you the best, and we'll reach out if a better fit comes up.`,
    });
    await sendEmail({ to: editor.email, subject: `Your onboarding with ${companyName}`, replyTo: recipients[0], ...email });
  }

  revalidateEditor(editorId);
  return { ok: true };
}
