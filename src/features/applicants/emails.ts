import { renderEmail } from "@/lib/email/render";
import { firstName } from "@/lib/utils";

/** To the admins: an application came in through the workspace's apply link. */
export function newApplicantEmail({
  companyName,
  accent,
  applicant,
  reviewUrl,
}: {
  companyName: string;
  accent: string;
  applicant: {
    full_name: string;
    email: string;
    portfolio_url: string;
    software: string[];
    specialties: string[];
    timezone: string;
    hourly_rate: number;
    weekly_hours: number;
    availability_notes?: string | null;
  };
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
          { label: `$${applicant.hourly_rate}/h` },
          { label: `${applicant.weekly_hours} h/week` },
          { label: applicant.timezone.replace(/_/g, " ") },
        ],
      },
      rows: [
        ["Email", applicant.email],
        ["Portfolio", applicant.portfolio_url],
        ["Availability", applicant.availability_notes],
      ],
      cta: { label: "Review the application", url: reviewUrl },
      secondary: { label: "Open their portfolio", url: applicant.portfolio_url },
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
