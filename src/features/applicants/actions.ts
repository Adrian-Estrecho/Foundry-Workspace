"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createEditorAccount, sendEditorInvite } from "@/features/editors/invite";
import { fail, fieldErrorsOf, optionalText, optionalUrl, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { renderEmail, sendEmail } from "@/lib/email";
import { adminEmailContext } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";
import { firstName } from "@/lib/utils";
import { Constants } from "@/types/database";
import { testSubmissionLink } from "./links";

const stageSchema = z.enum(Constants.public.Enums.applicant_stage);

function revalidateApplicant(id?: string) {
  revalidatePath("/editors/applicants");
  if (id) revalidatePath(`/editors/applicants/${id}`);
}

async function bottomOf(stage: z.infer<typeof stageSchema>) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applicants")
    .select("position")
    .eq("stage", stage)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

async function loadApplicant(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applicants")
    .select("id, full_name, email, timezone, stage, editor_id")
    .eq("id", id)
    .maybeSingle();
  return data;
}

const DECISION_ERROR = "Use Approve or Reject for that. They confirm first and can email the applicant.";

// -----------------------------------------------------------------------------
// Pipeline
// -----------------------------------------------------------------------------

/** Drag-and-drop move: new stage and/or order within the column. */
export async function moveApplicant(id: string, stage: string, position: number): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: z.uuid(), stage: stageSchema, position: z.number().finite() }).safeParse({ id, stage, position });
  if (!parsed.success) return fail("Invalid move.");

  const supabase = await createClient();
  const current = await loadApplicant(parsed.data.id);
  if (!current) return fail("That applicant no longer exists.");
  // Reordering inside a decision column is fine; entering one goes through a decision.
  if (parsed.data.stage !== current.stage && (parsed.data.stage === "approved" || parsed.data.stage === "rejected")) {
    return fail(DECISION_ERROR);
  }

  const { error } = await supabase
    .from("applicants")
    .update({ stage: parsed.data.stage, position: parsed.data.position })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  revalidateApplicant(id);
  return { ok: true };
}

/** Stage change from a menu or the applicant page: the card goes to the bottom of its new column. */
export async function setApplicantStage(id: string, stage: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: z.uuid(), stage: stageSchema }).safeParse({ id, stage });
  if (!parsed.success) return fail("Invalid stage.");
  if (parsed.data.stage === "approved" || parsed.data.stage === "rejected") return fail(DECISION_ERROR);

  const supabase = await createClient();
  const { error } = await supabase
    .from("applicants")
    .update({ stage: parsed.data.stage, position: await bottomOf(parsed.data.stage) })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  revalidateApplicant(id);
  return { ok: true };
}

/**
 * Approves an applicant: creates their editor account (filled in from the
 * application) and emails the Welcome to Foundry invite. Approving someone
 * who already has an account just moves the card.
 */
export async function approveApplicant(
  id: string,
  position?: number,
): Promise<ActionResult<{ editorId: string; invited: boolean }>> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success || (position !== undefined && !Number.isFinite(position))) {
    return fail("Invalid applicant.");
  }

  const applicant = await loadApplicant(id);
  if (!applicant) return fail("That applicant no longer exists.");

  let editorId = applicant.editor_id;
  if (!editorId) {
    const account = await createEditorAccount({
      email: applicant.email,
      fullName: applicant.full_name,
      timezone: applicant.timezone,
      applicantId: applicant.id,
    });
    if (!account.ok) return fail(account.error);
    editorId = account.userId;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("applicants")
    .update({ stage: "approved", position: position ?? (await bottomOf("approved")) })
    .eq("id", id);
  if (error) return fail(error.message);

  const invited = !applicant.editor_id;
  if (invited) {
    const sent = await sendEditorInvite(applicant.email, applicant.full_name);
    if (!sent.ok) {
      revalidateApplicant(id);
      return fail(`Account created, but the invite couldn't be sent: ${sent.error}. Resend it from their editor profile.`);
    }
  }

  revalidateApplicant(id);
  revalidatePath("/editors");
  return { ok: true, data: { editorId, invited } };
}

export async function rejectApplicant(id: string, notify: boolean, position?: number): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success || (position !== undefined && !Number.isFinite(position))) {
    return fail("Invalid applicant.");
  }

  const applicant = await loadApplicant(id);
  if (!applicant) return fail("That applicant no longer exists.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("applicants")
    .update({ stage: "rejected", position: position ?? (await bottomOf("rejected")) })
    .eq("id", id);
  if (error) return fail(error.message);

  if (notify) {
    const { recipients, accent, companyName } = await adminEmailContext();
    const email = renderEmail({
      accent,
      heading: `Your application to ${companyName}`,
      intro: `Thanks for applying, ${firstName(applicant.full_name)}, and for the time you put into it. We've reviewed your application and won't be moving forward right now. We'll keep your details on file and reach out if a better fit comes up.`,
    });
    await sendEmail({ to: applicant.email, subject: `Your application to ${companyName}`, replyTo: recipients[0], ...email });
  }

  revalidateApplicant(id);
  return { ok: true };
}

const testEditSchema = z.object({
  test_edit_url: z.url({ protocol: /^https?$/, error: "Enter the full link to the test brief (https://…)." }).max(500),
  note: optionalText(2000),
  send: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

/**
 * Saves the test edit link and, optionally, emails it to the applicant with
 * their personal submission link. Moves them to Test Edit Sent if they were
 * still at Applied.
 */
export async function sendTestEdit(id: string, formData: FormData): Promise<ActionResult<{ emailed: boolean }>> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return fail("Invalid applicant.");
  const parsed = testEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error));

  const applicant = await loadApplicant(id);
  if (!applicant) return fail("That applicant no longer exists.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("applicants")
    .update({
      test_edit_url: parsed.data.test_edit_url,
      ...(applicant.stage === "applied" && { stage: "test_edit_sent" as const, position: await bottomOf("test_edit_sent") }),
    })
    .eq("id", id);
  if (error) return fail(error.message);

  if (parsed.data.send) {
    const { recipients, accent, companyName } = await adminEmailContext();
    const email = renderEmail({
      accent,
      heading: `Your ${companyName} test edit`,
      intro: `Thanks for applying, ${firstName(applicant.full_name)}! The next step is a short test edit, so we can see how you work. The brief and footage are in the link below.`,
      rows: [
        ["Brief & footage", parsed.data.test_edit_url],
        ["Note from the team", parsed.data.note],
      ],
      cta: { label: "Send us your finished edit", url: testSubmissionLink(id) },
      footnote:
        "When you're done, upload your edit anywhere we can watch it (Frame.io, Vimeo, Google Drive or unlisted YouTube), then send us the link with the button above.",
    });
    await sendEmail({ to: applicant.email, subject: `Your ${companyName} test edit`, replyTo: recipients[0], ...email });
  }

  revalidateApplicant(id);
  return { ok: true, data: { emailed: parsed.data.send } };
}

// -----------------------------------------------------------------------------
// Applicant page
// -----------------------------------------------------------------------------

const linksSchema = z.object({
  test_edit_url: optionalUrl(),
  test_submission_url: optionalUrl(),
});

/**
 * Test links edited by hand. Adding a submission link while the test is
 * out (e.g. they replied by email) moves them to Test Submitted.
 */
export async function updateTestLinks(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return fail("Invalid applicant.");
  const parsed = linksSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error));

  const applicant = await loadApplicant(id);
  if (!applicant) return fail("That applicant no longer exists.");

  const submitted =
    Boolean(parsed.data.test_submission_url) && (applicant.stage === "applied" || applicant.stage === "test_edit_sent");
  const supabase = await createClient();
  const { error } = await supabase
    .from("applicants")
    .update({
      ...parsed.data,
      ...(submitted && { stage: "test_submitted" as const, position: await bottomOf("test_submitted") }),
    })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidateApplicant(id);
  return { ok: true };
}

export async function setApplicantRating(id: string, rating: number | null): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ id: z.uuid(), rating: z.number().int().min(1).max(5).nullable() })
    .safeParse({ id, rating });
  if (!parsed.success) return fail("Pick a rating from 1 to 5.");

  const supabase = await createClient();
  const { error } = await supabase.from("applicants").update({ rating: parsed.data.rating }).eq("id", id);
  if (error) return fail(error.message);

  revalidateApplicant(id);
  return { ok: true };
}

export async function updateApplicantNotes(id: string, notes: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: z.uuid(), notes: z.string().max(20_000) }).safeParse({ id, notes });
  if (!parsed.success) return fail("Notes are too long.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("applicants")
    .update({ admin_notes: parsed.data.notes.trim() || null })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidateApplicant(id);
  return { ok: true };
}

/** Deletes an application (e.g. spam). An editor account made from it stays. */
export async function deleteApplicant(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return fail("Invalid applicant.");

  const supabase = await createClient();
  const { error } = await supabase.from("applicants").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidateApplicant();
  return { ok: true };
}
