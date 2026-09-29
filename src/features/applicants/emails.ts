import { answerRows } from "@/features/forms/emails";
import type { Answer } from "@/features/forms/fields";
import { renderEmail } from "@/lib/email/render";
import { firstName } from "@/lib/utils";

/**
 * To the admins: an application came in through the workspace's apply link.
 * Admins can take questions off the form, so most of it may be missing.
 */
export function newApplicantEmail({
  companyName,
  accent,
  applicant,
  answers = [],
  reviewUrl,
}: {
  companyName: string;
  accent: string;
  applicant: {
    full_name: string;
    email: string;
    portfolio_url?: string | null;
    software: string[];
    specialties: string[];
    timezone?: string | null;
    hourly_rate?: number | null;
    weekly_hours?: number | null;
    availability_notes?: string | null;
  };
  /** Answers to the workspace's own questions. */
  answers?: Answer[];
  reviewUrl: string;
}) {
  return {
    subject: `New applicant: ${applicant.full_name}`,
    ...renderEmail({
      brand: companyName,
      accent,
      eyebrow: "New applicant",
      heading: `${applicant.full_name} wants to edit with you`,
      intro: "A new editor application just came in. It's waiting in Applied.",
      card: {
        kicker: applicant.specialties.join(" · ") || "Editor",
        title: applicant.full_name,
        text: applicant.software.length ? `Works in ${applicant.software.join(", ")}` : null,
        chips: [
          applicant.hourly_rate != null ? { label: `$${applicant.hourly_rate}/h` } : null,
          applicant.weekly_hours != null ? { label: `${applicant.weekly_hours} h/week` } : null,
          applicant.timezone ? { label: applicant.timezone.replace(/_/g, " ") } : null,
        ],
      },
      rows: [
        ["Email", applicant.email],
        ["Portfolio", applicant.portfolio_url],
        ["Availability", applicant.availability_notes],
        ...answerRows(answers),
      ],
      cta: { label: "Review the application", url: reviewUrl },
      secondary: applicant.portfolio_url ? { label: "Open their portfolio", url: applicant.portfolio_url } : undefined,
      footnote: `Replying to this email goes straight to ${firstName(applicant.full_name)}.`,
    }),
  };
}

/** To the applicant, when an admin turns the application down and chooses to tell them. */
export function applicationDeclinedEmail({ companyName, accent, name }: { companyName: string; accent: string; name: string }) {
  return {
    subject: `Your application to ${companyName}`,
    ...renderEmail({
      brand: companyName,
      accent,
      eyebrow: "Your application",
      heading: `Thanks for applying to ${companyName}`,
      intro: `Thanks for applying, ${firstName(name)}, and for the time you put into it. We've reviewed your application and won't be moving forward right now.`,
      outro: "We'll keep your details on file and reach out if a better fit comes up.",
      signoff: companyName,
    }),
  };
}
