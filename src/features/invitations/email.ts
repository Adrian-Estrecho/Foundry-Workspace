import "server-only";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email/render";
import { env } from "@/lib/env";
import { adminEmailContext } from "@/lib/notify";
import { firstName } from "@/lib/utils";
import { formatInviteCode, joinUrl } from "./constants";

/** "You're invited to join <workspace>": the code, and a button that fills it in. */
export function invitationEmail({
  companyName,
  accent,
  name,
  code,
  expires,
  url,
}: {
  companyName: string;
  accent: string;
  name: string | null;
  code: string;
  /** "October 13" */
  expires: string;
  url: string;
}) {
  return {
    subject: `You're invited to join ${companyName}`,
    ...renderEmail({
      brand: companyName,
      accent,
      eyebrow: "Invitation",
      heading: `Join ${companyName} as an editor`,
      intro: `Hi ${firstName(name)}, good news: ${companyName} would like you on the team. Accept the invitation to start onboarding.`,
      card: {
        kicker: "Your invitation code",
        title: formatInviteCode(code),
        chips: [{ label: `Works until ${expires}` }, { label: "Single use" }],
      },
      steps: [
        { label: "Sign in, or create a free ReEdit account" },
        { label: "Enter the code", note: "The button below fills it in for you." },
        { label: "Start onboarding", note: "A few setup steps, a short test edit and a quick interview." },
      ],
      cta: { label: "Accept the invitation", url },
      footnote: "Questions? Just reply to this email.",
    }),
  };
}

export async function sendInvitationEmail(invitation: {
  workspaceId: string;
  code: string;
  email: string;
  name: string | null;
  expiresAt: string;
}) {
  const { recipients, accent, companyName } = await adminEmailContext(invitation.workspaceId);
  const email = invitationEmail({
    companyName,
    accent,
    name: invitation.name,
    code: invitation.code,
    expires: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(new Date(invitation.expiresAt)),
    url: joinUrl(env.siteUrl, invitation.code),
  });
  await sendEmail({ to: invitation.email, replyTo: recipients[0], ...email });
}
