import "server-only";

/**
 * Outgoing email.
 *   * MAILPIT_URL set   → delivered to the local Mailpit inbox (development),
 *                         even when a Brevo key is present, so local work and
 *                         tests never email real people.
 *   * BREVO_API_KEY set → sent with Brevo's transactional API (production).
 *   * neither           → logged to the server console.
 * Email is always best-effort: failures are logged, never thrown, so a lost
 * email can't break the action that triggered it.
 */

type Email = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

function parseAddress(value: string) {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return match ? { name: match[1].trim(), email: match[2].trim() } : { name: "", email: value.trim() };
}

export async function sendEmail(email: Email): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "ReEdit <no-reply@foundrymedia.co>";
  const to = Array.isArray(email.to) ? email.to : [email.to];
  if (to.length === 0) return;

  try {
    const sender = parseAddress(from);

    if (process.env.MAILPIT_URL) {
      const response = await fetch(`${process.env.MAILPIT_URL}/api/v1/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: { Email: sender.email, Name: sender.name },
          To: to.map((address) => ({ Email: address })),
          ReplyTo: email.replyTo ? [{ Email: email.replyTo }] : undefined,
          Subject: email.subject,
          HTML: email.html,
          Text: email.text,
        }),
      });
      if (!response.ok) console.error("[email] Mailpit rejected the message:", response.status, await response.text());
      return;
    }

    if (process.env.BREVO_API_KEY) {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { email: sender.email, name: sender.name || undefined },
          to: to.map((address) => ({ email: address })),
          replyTo: email.replyTo ? { email: email.replyTo } : undefined,
          subject: email.subject,
          htmlContent: email.html,
          textContent: email.text,
        }),
      });
      if (!response.ok) console.error("[email] Brevo rejected the message:", response.status, await response.text());
      return;
    }

    console.info(`[email] (not sent, no provider configured) to=${to.join(", ")} subject="${email.subject}"`);
  } catch (error) {
    console.error("[email] send failed:", error);
  }
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

const isLink = (value: string) => /^https?:\/\/\S+$/.test(value);

/**
 * Branded HTML email (dark card, accent button), matching the auth emails.
 * All values are escaped; a row whose value is a single URL becomes a link.
 */
export function renderEmail({
  heading,
  intro,
  rows = [],
  cta,
  footnote,
  accent = "#F2711C",
  brand = "ReEdit",
}: {
  heading: string;
  intro?: string;
  rows?: [label: string, value: string | null | undefined][];
  cta?: { label: string; url: string };
  /** Small print under the button. */
  footnote?: string;
  accent?: string;
  /** Name at the top: the workspace, or ReEdit itself. */
  brand?: string;
}) {
  const visibleRows = rows.filter(([, value]) => value);
  const html = `<!doctype html><html><body style="margin:0;background:#130d0a;font-family:Helvetica,Arial,sans-serif;color:#f5efe9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1f1612;border:1px solid #33261f;border-radius:20px;padding:36px">
<tr><td style="font-size:20px;font-weight:600;color:${accent}">${escapeHtml(brand)}</td></tr>
<tr><td style="padding-top:24px;font-size:22px;font-weight:600">${escapeHtml(heading)}</td></tr>
${intro ? `<tr><td style="padding-top:10px;font-size:15px;line-height:1.6;color:#c9bcb2">${escapeHtml(intro)}</td></tr>` : ""}
${
  visibleRows.length
    ? `<tr><td style="padding-top:20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${visibleRows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:6px 0;font-size:13px;color:#8c7d72;width:140px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;color:#f5efe9;white-space:pre-line">${
              isLink(value!)
                ? `<a href="${escapeHtml(value!)}" style="color:${accent};word-break:break-all">${escapeHtml(value!)}</a>`
                : escapeHtml(value!)
            }</td></tr>`,
        )
        .join("")}</table></td></tr>`
    : ""
}
${
  cta
    ? `<tr><td style="padding-top:28px"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:12px">${escapeHtml(cta.label)}</a></td></tr>`
    : ""
}
${footnote ? `<tr><td style="padding-top:28px;font-size:12px;line-height:1.5;color:#8c7d72">${escapeHtml(footnote)}</td></tr>` : ""}
</table></td></tr></table></body></html>`;

  const text = [
    heading,
    intro,
    ...visibleRows.map(([label, value]) => `${label}: ${value}`),
    cta && `${cta.label}: ${cta.url}`,
    footnote,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { html, text };
}
