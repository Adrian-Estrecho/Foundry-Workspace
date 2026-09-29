import { answerRows } from "@/features/forms/emails";
import type { Answer } from "@/features/forms/fields";
import { renderEmail } from "@/lib/email/render";
import { formatDay } from "@/lib/dates";
import { firstName } from "@/lib/utils";

/** To the admins: a project enquiry came in through the workspace's intake form. */
export function newLeadEmail({
  companyName,
  accent,
  lead,
  answers = [],
  clientUrl,
}: {
  /** Answers to the workspace's own questions. */
  answers?: Answer[];
  companyName: string;
  accent: string;
  lead: {
    name: string;
    company?: string | null;
    email: string;
    phone?: string | null;
    project_type?: string | null;
    budget_range?: string | null;
    /** YYYY-MM-DD */
    deadline?: string | null;
    reference_links: string[];
    notes?: string | null;
  };
  clientUrl: string;
}) {
  const who = lead.company ?? lead.name;
  const notes = lead.notes?.trim();
  return {
    subject: `New lead: ${who}`,
    ...renderEmail({
      brand: companyName,
      accent,
      eyebrow: "New lead",
      heading: `${who} wants to work with you`,
      intro: "A new project enquiry just came in through your intake form. It's waiting in New Lead.",
      card: {
        kicker: lead.project_type ?? "Project enquiry",
        title: lead.company ? `${lead.company} · ${lead.name}` : lead.name,
        text: notes ? (notes.length > 360 ? `${notes.slice(0, 359).trimEnd()}…` : notes) : null,
        chips: [
          lead.budget_range ? { label: lead.budget_range } : null,
          lead.deadline
            ? { label: `Deadline ${formatDay(lead.deadline, { month: "short", day: "numeric", year: "numeric" })}` }
            : null,
        ],
      },
      rows: [
        ["Email", lead.email],
        ["Phone", lead.phone],
        ["References", lead.reference_links.join("\n")],
        ...answerRows(answers),
      ],
      cta: { label: "Open the lead", url: clientUrl },
      secondary: { label: `Email ${firstName(lead.name)}`, url: `mailto:${lead.email}` },
      footnote: `Replying to this email goes straight to ${lead.email}.`,
    }),
  };
}
