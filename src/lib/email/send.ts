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

export type Email = {
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
