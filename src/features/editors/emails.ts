import { renderEmail } from "@/lib/email/render";
import { firstName } from "@/lib/utils";

/**
 * Emails to editors joining a workspace: welcome aboard (they joined with an
 * invitation and start onboarding), the interview, you're in (approved), and
 * the polite "not this time". Plain data in, email out.
 */

type Workspace = { companyName: string; accent: string };

/** Sent when someone joins with an invitation code. */
export function welcomeAboardEmail({
  companyName,
  accent,
  name,
  ownerName,
  onboardingUrl,
  timeZone,
}: Workspace & { name: string | null; ownerName: string | null; onboardingUrl: string; timeZone?: string | null }) {
  const contact = ownerName ? firstName(ownerName) : "the team";
  return {
    subject: `Welcome to ${companyName}`,
    ...renderEmail({
      brand: companyName,
      accent,
      timeZone,
      tone: "success",
      eyebrow: "Welcome aboard",
      heading: `Welcome to ${companyName}, ${firstName(name)}`,
      intro: `Glad to have you. Before your first client project there's a short onboarding: some setup, a test edit and a quick interview. It all happens on your Onboarding page, in this order:`,
      steps: [
        { label: "Contract and NDA", note: "Download them, sign, and upload both." },
        { label: "Payment details", note: "So we know where to send your pay." },
        { label: "Frame.io", note: "All reviews happen there. Accept the invite." },
        { label: "Required SOPs", note: "How we edit, review and deliver." },
        { label: "Asset pack", note: "Fonts, LUTs, SFX and templates we use on client work." },
        { label: "Test edit", note: "A short, real-world task so we can see how you work." },
        { label: "Interview", note: "A quick call to meet the team." },
      ],
      outro: `When everything's done, ${companyName} gives the final approval and your full workspace opens up: projects, tasks and attendance.`,
      cta: { label: "Start onboarding", url: onboardingUrl },
      signoff: `Questions along the way? Reply to this email and ${contact} will get back to you.`,
      footnote: `You're getting this because you accepted an invitation to join ${companyName} on ReEdit.`,
    }),
  };
}

/** Sent when an admin approves an editor: onboarding is over. */
export function youreInEmail({
  companyName,
  accent,
  name,
  dashboardUrl,
  sopsUrl,
  timeZone,
}: Workspace & { name: string | null; dashboardUrl: string; sopsUrl: string; timeZone?: string | null }) {
  return {
    subject: `You're in: welcome to ${companyName}`,
    ...renderEmail({
      brand: companyName,
      accent,
      timeZone,
      tone: "success",
      eyebrow: "You're in",
      heading: `Welcome to the team, ${firstName(name)}`,
      intro: `${companyName} has approved you. Onboarding is done and your full workspace is open. Here's how a normal day works:`,
      steps: [
        { label: "Start work in Attendance", note: "Clock in when you begin and pick the task you're on. Breaks and switching tasks happen there too." },
        { label: "Check My Tasks", note: "New work lands here. Move a task to In Progress when you start; if one sits in To Do, you'll get a reminder." },
        { label: "Hand in for review", note: "Move it to For Review with your link. Feedback comes back as comments on the task." },
        { label: "Ask in Messages", note: "Your private thread with the admins, for anything at all." },
      ],
      outro: "Check your time zone in Settings too, so deadlines and reminders line up with your day.",
      cta: { label: "Open your dashboard", url: dashboardUrl },
      secondary: { label: "Read the SOPs", url: sopsUrl },
      signoff: `Glad you're here.\n${companyName}`,
    }),
  };
}

export function interviewEmail({
  companyName,
  accent,
  name,
  moved,
  when,
  durationMinutes,
  meetingUrl,
  note,
  onboardingUrl,
  timeZone,
}: Workspace & {
  name: string | null;
  moved: boolean;
  when: string;
  durationMinutes: number;
  meetingUrl: string | null | undefined;
  note: string | null | undefined;
  onboardingUrl: string;
  timeZone?: string | null;
}) {
  return {
    subject: `${moved ? "Interview moved" : "Interview booked"}: ${companyName}`,
    ...renderEmail({
      brand: companyName,
      accent,
      timeZone,
      eyebrow: moved ? "Interview moved" : "Interview booked",
      heading: moved ? "Your interview has moved" : "Your interview is booked",
      intro: `Hi ${firstName(name)}, ${moved ? "here's the new time for" : "here are the details of"} your interview with ${companyName}.`,
      card: {
        kicker: "Interview",
        title: when,
        text: note,
        chips: [{ label: `${durationMinutes} minutes` }, meetingUrl ? { label: "Video call" } : null],
      },
      rows: [["Meeting link", meetingUrl]],
      cta: meetingUrl ? { label: "Join the call", url: meetingUrl } : { label: "Open your onboarding", url: onboardingUrl },
      secondary: meetingUrl ? { label: "Open your onboarding", url: onboardingUrl } : undefined,
      footnote: "Can't make it? Reply to this email and we'll find another time.",
    }),
  };
}

export function onboardingEndedEmail({ companyName, accent, name }: Workspace & { name: string | null }) {
  return {
    subject: `Your onboarding with ${companyName}`,
    ...renderEmail({
      brand: companyName,
      accent,
      eyebrow: "Onboarding",
      heading: `Your onboarding with ${companyName}`,
      intro: `Thanks for the time you put into onboarding, ${firstName(name)}. We've decided not to move forward right now, so your access to the ${companyName} workspace has ended.`,
      outro: "We wish you the best, and we'll reach out if a better fit comes up.",
      signoff: companyName,
    }),
  };
}
