import { renderEmail } from "@/lib/email/render";
import { firstName } from "@/lib/utils";

/** To a client: the team replied in their portal. */
export function clientReplyEmail({
  companyName,
  accent,
  clientName,
  author,
  body,
  portalUrl,
}: {
  companyName: string;
  accent: string;
  clientName: string | null;
  author: string;
  body: string;
  portalUrl: string;
}) {
  return {
    subject: `New message from ${companyName}`,
    ...renderEmail({
      brand: companyName,
      accent,
      eyebrow: "New message",
      heading: `${firstName(author)} replied to you`,
      intro: `Hi ${firstName(clientName)}, there's a new message about your project with ${companyName}:`,
      quotes: [{ author, body: body.length > 1200 ? `${body.slice(0, 1199).trimEnd()}…` : body, meta: companyName }],
      cta: { label: "Reply in your portal", url: portalUrl },
      footnote: "Reply in the portal so the whole team sees it. The link is private to you, so please don't share it.",
    }),
  };
}
