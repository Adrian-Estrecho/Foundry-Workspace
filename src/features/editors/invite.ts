import "server-only";
import { renderEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { adminEmailContext } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { firstName } from "@/lib/utils";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Creates an editor's account. The profile, editor record and onboarding
 * checklist come from the handle_new_user trigger; with an applicant id the
 * editor record is filled in from their application. The account stays
 * unconfirmed until they accept the invite.
 */
export async function createEditorAccount(editor: {
  email: string;
  fullName: string;
  timezone?: string | null;
  applicantId?: string | null;
}): Promise<Result<{ userId: string }>> {
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email: editor.email,
    email_confirm: false,
    app_metadata: { role: "editor", applicant_id: editor.applicantId ?? null },
    user_metadata: { full_name: editor.fullName, timezone: editor.timezone ?? undefined },
  });
  if (error) {
    return {
      ok: false,
      error: error.code === "email_exists" ? "Someone with this email already has a Foundry account." : error.message,
    };
  }
  return { ok: true, userId: data.user.id };
}

/**
 * Emails the "Welcome to Foundry" link, which lands on /welcome to choose a
 * password. Before the editor has accepted it's an invite link; afterwards
 * (lost email, expired link) Supabase only issues a set-password link.
 */
export async function sendEditorInvite(to: string, fullName: string): Promise<Result> {
  const supabase = createAdminClient();
  let type: "invite" | "recovery" = "invite";
  let link = await supabase.auth.admin.generateLink({ type: "invite", email: to });
  if (link.error?.code === "email_exists") {
    type = "recovery";
    link = await supabase.auth.admin.generateLink({ type: "recovery", email: to });
  }
  if (link.error) return { ok: false, error: link.error.message };

  const url = `${env.siteUrl}/auth/confirm?token_hash=${encodeURIComponent(link.data.properties.hashed_token)}&type=${type}&next=/welcome`;
  const { recipients, accent, companyName } = await adminEmailContext();
  const email = renderEmail({
    accent,
    heading: `Welcome to Foundry, ${firstName(fullName)}`,
    intro: `You've been added to the ${companyName} editing team. Choose a password to get started, and Foundry will walk you through onboarding: contract, payment details, tools and your first trial task.`,
    cta: { label: type === "invite" ? "Accept invite" : "Set your password", url },
    footnote: "For your security this link expires soon. If it has, reply to this email and we'll send a new one.",
  });
  await sendEmail({ to, subject: `Welcome to ${companyName}`, replyTo: recipients[0], ...email });
  return { ok: true };
}
