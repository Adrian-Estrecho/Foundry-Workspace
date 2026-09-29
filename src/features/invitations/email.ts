import "server-only";
import { renderEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { adminEmailContext } from "@/lib/notify";
import { firstName } from "@/lib/utils";
import { formatInviteCode, joinUrl } from "./constants";

/** "You're invited to join <workspace>": the code, and a button that fills it in. */
export async function sendInvitationEmail(invitation: {
  workspaceId: string;
  code: string;
  email: string;
  name: string | null;
  expiresAt: string;
}) {
  const { recipients, accent, companyName } = await adminEmailContext(invitation.workspaceId);
  const expires = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(new Date(invitation.expiresAt));
  const email = renderEmail({
    accent,
    brand: companyName,
    heading: `Join ${companyName} as an editor`,
    intro: `Hi ${firstName(invitation.name)}, good news: ${companyName} would like you on the team. Accept the invitation to start onboarding: a few setup steps, a short test edit and a quick interview.`,
    rows: [
      ["Invitation code", formatInviteCode(invitation.code)],
      ["Works until", expires],
    ],
    cta: { label: "Accept the invitation", url: joinUrl(env.siteUrl, invitation.code) },
    footnote:
      "New to ReEdit? Create a free account first, then enter the code (the button fills it in for you). The code works once. Questions? Just reply to this email.",
  });
  await sendEmail({
    to: invitation.email,
    subject: `You're invited to join ${companyName}`,
    replyTo: recipients[0],
    ...email,
  });
}
