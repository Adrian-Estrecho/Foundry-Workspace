"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { welcomeAboardEmail } from "@/features/editors/emails";
import { fail, fieldErrorsOf, type ActionResult } from "@/lib/action-result";
import { requireAccount, requirePermission } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { adminEmailContext, workspaceLink } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";
import { INVITATION_DAYS } from "./constants";
import { sendInvitationEmail } from "./email";

const idSchema = z.uuid();
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

function revalidateHiring(applicantId?: string | null) {
  revalidatePath("/editors");
  revalidatePath("/editors/applicants");
  if (applicantId) revalidatePath(`/editors/applicants/${applicantId}`);
}

async function bottomOfApplicantColumn(stage: "invited" | "shortlisted") {
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

// -----------------------------------------------------------------------------
// Admins
// -----------------------------------------------------------------------------

/**
 * "Invite to join": creates an invitation code for an applicant, emails it
 * and moves them to Invited. An invitation that is still open is sent again
 * rather than duplicated.
 */
export async function inviteApplicant(applicantId: string, position?: number): Promise<ActionResult<{ code: string }>> {
  const user = await requirePermission("editors.manage");
  if (!idSchema.safeParse(applicantId).success || (position !== undefined && !Number.isFinite(position))) {
    return fail("Invalid applicant.");
  }

  const supabase = await createClient();
  const { data: applicant } = await supabase
    .from("applicants")
    .select("id, full_name, email, stage")
    .eq("id", applicantId)
    .maybeSingle();
  if (!applicant) return fail("That applicant no longer exists.");
  if (applicant.stage === "joined") return fail(`${applicant.full_name} has already joined.`);

  const { data: open } = await supabase
    .from("workspace_invitations")
    .select("id, code")
    .eq("applicant_id", applicantId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const expiresAt = inDays(INVITATION_DAYS);
  const { data: invitation, error } = open
    ? await supabase
        .from("workspace_invitations")
        .update({ expires_at: expiresAt, sent_at: new Date().toISOString() })
        .eq("id", open.id)
        .select("code")
        .single()
    : await supabase
        .from("workspace_invitations")
        .insert({
          applicant_id: applicantId,
          email: applicant.email,
          full_name: applicant.full_name,
          sent_at: new Date().toISOString(),
        })
        .select("code, expires_at")
        .single();
  if (error || !invitation) return fail("Couldn't create the invitation. Try again.");

  const { error: stageError } = await supabase
    .from("applicants")
    .update({ stage: "invited", position: position ?? (await bottomOfApplicantColumn("invited")) })
    .eq("id", applicantId);
  if (stageError) return fail(stageError.message);

  await sendInvitationEmail({
    workspaceId: user.workspace.id,
    code: invitation.code,
    email: applicant.email,
    name: applicant.full_name,
    expiresAt,
  });

  revalidateHiring(applicantId);
  return { ok: true, data: { code: invitation.code } };
}

const directSchema = z.object({
  full_name: z.string().trim().min(2, "Enter their name.").max(120),
  email: z.email("Enter a valid email.").max(200),
});

/** Invites an editor who didn't come through the application form. */
export async function inviteEditor(formData: FormData): Promise<ActionResult<{ code: string }>> {
  const user = await requirePermission("editors.manage");
  const parsed = directSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { data: invitation, error } = await supabase
    .from("workspace_invitations")
    .insert({
      email: parsed.data.email.toLowerCase(),
      full_name: parsed.data.full_name,
      sent_at: new Date().toISOString(),
    })
    .select("code, expires_at")
    .single();
  if (error || !invitation) return fail("Couldn't create the invitation. Try again.");

  await sendInvitationEmail({
    workspaceId: user.workspace.id,
    code: invitation.code,
    email: parsed.data.email,
    name: parsed.data.full_name,
    expiresAt: invitation.expires_at,
  });

  revalidateHiring();
  return { ok: true, data: { code: invitation.code } };
}

/** Emails an open invitation again, good for another two weeks. */
export async function resendInvitation(id: string): Promise<ActionResult> {
  const user = await requirePermission("editors.manage");
  if (!idSchema.safeParse(id).success) return fail("Invalid invitation.");

  const expiresAt = inDays(INVITATION_DAYS);
  const supabase = await createClient();
  const { data: invitation } = await supabase
    .from("workspace_invitations")
    .update({ expires_at: expiresAt, sent_at: new Date().toISOString() })
    .eq("id", id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("code, email, full_name, applicant_id")
    .maybeSingle();
  if (!invitation) return fail("That invitation was already used or revoked.");
  if (!invitation.email) return fail("There's no email address on this invitation. Copy the link and send it yourself.");

  await sendInvitationEmail({
    workspaceId: user.workspace.id,
    code: invitation.code,
    email: invitation.email,
    name: invitation.full_name,
    expiresAt,
  });

  revalidateHiring(invitation.applicant_id);
  return { ok: true };
}

/** Stops a code from working. Their application goes back to Shortlisted. */
export async function revokeInvitation(id: string): Promise<ActionResult> {
  await requirePermission("editors.manage");
  if (!idSchema.safeParse(id).success) return fail("Invalid invitation.");

  const supabase = await createClient();
  const { data: invitation } = await supabase
    .from("workspace_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("applicant_id")
    .maybeSingle();
  if (!invitation) return fail("That invitation was already used or revoked.");

  if (invitation.applicant_id) {
    await supabase
      .from("applicants")
      .update({ stage: "shortlisted", position: await bottomOfApplicantColumn("shortlisted") })
      .eq("id", invitation.applicant_id)
      .eq("stage", "invited");
  }

  revalidateHiring(invitation.applicant_id);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// The person invited
// -----------------------------------------------------------------------------

export type InvitationPreview = {
  status: "valid" | "member" | "expired" | "revoked" | "used" | "not_found" | "rate_limited";
  workspaceName: string | null;
  invitedBy: string | null;
  /** Where it was sent, when that isn't the signed-in account's email. */
  sentTo: string | null;
};

const codeSchema = z.string().trim().min(4).max(40);

/** What a code would do, shown before joining. */
export async function previewInvitation(code: string): Promise<ActionResult<InvitationPreview>> {
  const account = await requireAccount();
  if (!codeSchema.safeParse(code).success) return fail("Enter the code from your invitation.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_invitation", { p_code: code }).maybeSingle();
  if (error || !data) return fail("Couldn't check that code. Try again.");

  const sentTo = data.email && data.email.toLowerCase() !== account.email.toLowerCase() ? data.email : null;
  return {
    ok: true,
    data: {
      status: data.status as InvitationPreview["status"],
      workspaceName: data.workspace_name,
      invitedBy: data.invited_by_name,
      sentTo,
    },
  };
}

const ACCEPT_ERRORS: Record<string, string> = {
  expired: "This invitation has expired. Ask the team to send a new one.",
  revoked: "This invitation was withdrawn. Ask the team if you think that's a mistake.",
  used: "This invitation has already been used.",
  not_found: "That code doesn't match an invitation. Check it and try again.",
  rate_limited: "Too many wrong codes. Wait 15 minutes and try again.",
};

/** Joins the workspace behind the code, then opens onboarding with a welcome email. */
export async function acceptInvitation(code: string): Promise<ActionResult> {
  const account = await requireAccount();
  if (!codeSchema.safeParse(code).success) return fail("Enter the code from your invitation.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_code: code }).maybeSingle();
  if (error || !data) return fail("Couldn't accept the invitation. Try again.");

  if (data.status === "member" && data.workspace_id) {
    await supabase.rpc("set_active_workspace", { p_workspace_id: data.workspace_id });
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }
  if (data.status !== "joined") return fail(ACCEPT_ERRORS[data.status] ?? "Couldn't accept the invitation.");

  const workspaceId = data.workspace_id;
  if (workspaceId) {
    after(async () => {
      const { recipients, ownerName, accent, companyName } = await adminEmailContext(workspaceId);
      const email = welcomeAboardEmail({
        companyName,
        accent,
        name: account.full_name,
        ownerName,
        onboardingUrl: workspaceLink(env.siteUrl, workspaceId, "/onboarding"),
        timeZone: account.timezone,
      });
      await sendEmail({ to: account.email, replyTo: recipients[0], ...email });
    });
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}
