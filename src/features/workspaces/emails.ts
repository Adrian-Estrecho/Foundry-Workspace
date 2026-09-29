import { renderEmail } from "@/lib/email/render";
import { firstName } from "@/lib/utils";

/** To the owner of a new workspace: how to get it running. */
export function workspaceWelcomeEmail({
  name,
  ownerName,
  accent,
  intakeUrl,
  applyUrl,
  dashboardUrl,
  timeZone,
}: {
  name: string;
  ownerName: string | null;
  accent: string;
  intakeUrl: string;
  applyUrl: string;
  dashboardUrl: string;
  timeZone?: string | null;
}) {
  return {
    subject: `${name} is ready on ReEdit`,
    ...renderEmail({
      brand: name,
      accent,
      timeZone,
      tone: "success",
      eyebrow: "Workspace ready",
      heading: `${name} is ready, ${firstName(ownerName)}`,
      intro: "Your workspace is set up. Here's how to get it running:",
      steps: [
        { label: "Make it yours", note: "Pick your accent colour and check your time zone in Settings." },
        { label: "Share your intake form", note: "Clients describe their project, and it lands in New Lead." },
        { label: "Share your application link", note: "Editors apply, and you invite the ones you like." },
        { label: "Invite editors you already know", note: "From Editors, send an invitation. They join with a code and go through onboarding." },
        { label: "Write your SOPs", note: "New editors read them during onboarding." },
      ],
      rows: [
        ["Intake form", intakeUrl],
        ["Application link", applyUrl],
      ],
      cta: { label: "Open your dashboard", url: dashboardUrl },
      footnote: "You're getting this because you created this workspace on ReEdit.",
    }),
  };
}
