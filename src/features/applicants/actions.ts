"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { adminEmailContext } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";
import { Constants } from "@/types/database";
import { isDecisionStage, JOINED_MESSAGE } from "./constants";
import { applicationDeclinedEmail } from "./emails";

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

const DECISION_ERROR = "Use Invite or Reject for that. They confirm first and can email the applicant.";

/** Entering Invited, Joined or Rejected goes through a decision (or happens by itself). */
function blockedMove(from: z.infer<typeof stageSchema>, to: z.infer<typeof stageSchema>) {
  if (to === from) return null;
  if (to === "joined" || from === "joined") return JOINED_MESSAGE;
  if (isDecisionStage(to)) return DECISION_ERROR;
  return null;
}

// -----------------------------------------------------------------------------
// Pipeline
// -----------------------------------------------------------------------------

/** Drag-and-drop move: new stage and/or order within the column. */
export async function moveApplicant(id: string, stage: string, position: number): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: z.uuid(), stage: stageSchema, position: z.number().finite() }).safeParse({ id, stage, position });
  if (!parsed.success) return fail("Invalid move.");

  const current = await loadApplicant(parsed.data.id);
  if (!current) return fail("That applicant no longer exists.");
  const blocked = blockedMove(current.stage, parsed.data.stage);
  if (blocked) return fail(blocked);

  const supabase = await createClient();
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

  const current = await loadApplicant(parsed.data.id);
  if (!current) return fail("That applicant no longer exists.");
  const blocked = blockedMove(current.stage, parsed.data.stage);
  if (blocked) return fail(blocked);

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
 * Rejects an applicant, optionally with a short, polite email. An open
 * invitation stops working.
 */
export async function rejectApplicant(id: string, notify: boolean, position?: number): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!z.uuid().safeParse(id).success || (position !== undefined && !Number.isFinite(position))) {
    return fail("Invalid applicant.");
  }

  const applicant = await loadApplicant(id);
  if (!applicant) return fail("That applicant no longer exists.");
  if (applicant.stage === "joined") return fail("They've already joined. Decide on them from their editor profile.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("applicants")
    .update({ stage: "rejected", position: position ?? (await bottomOf("rejected")) })
    .eq("id", id);
  if (error) return fail(error.message);

  await supabase
    .from("workspace_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("applicant_id", id)
    .is("accepted_at", null)
    .is("revoked_at", null);

  if (notify) {
    const { recipients, accent, companyName } = await adminEmailContext(user.workspace.id);
    const email = applicationDeclinedEmail({ companyName, accent, name: applicant.full_name });
    await sendEmail({ to: applicant.email, replyTo: recipients[0], ...email });
  }

  revalidateApplicant(id);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Applicant page
// -----------------------------------------------------------------------------

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

/** Deletes an application (e.g. spam). Someone who already joined stays an editor. */
export async function deleteApplicant(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return fail("Invalid applicant.");

  const supabase = await createClient();
  const { error } = await supabase.from("applicants").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidateApplicant();
  return { ok: true };
}
