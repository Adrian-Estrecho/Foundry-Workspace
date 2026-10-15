/** Frame.io and Google Drive links: which is which, and finding them in text. */

export type LinkKind = "frameio" | "drive";

export const LINK_KINDS: { value: LinkKind; label: string }[] = [
  { value: "frameio", label: "Frame.io" },
  { value: "drive", label: "Drive" },
];

/** Frame.io or Drive, or null for any other link. Only http(s): the database accepts `javascript:` URLs. */
export function linkKind(url: string): LinkKind | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const host = parsed.hostname.toLowerCase();
  if (host === "f.io" || host === "frame.io" || host.endsWith(".frame.io")) return "frameio";
  if (host === "drive.google.com") return "drive";
  return null;
}

// ClickUp drops the https:// from some links ("Edited: f.io/abc"), so the scheme is optional.
const TEXT_LINK = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:frame\.io|f\.io|drive\.google\.com)\/[^\s<>"'`()[\]]*/gi;

/** The Frame.io and Drive links in some text, absolute and without trailing punctuation. */
export function findLinks(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const [match] of text.matchAll(TEXT_LINK)) {
    const trimmed = match.replace(/[.,;:!?*]+$/, "");
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (linkKind(url)) found.add(url);
  }
  return [...found];
}

/** "https://app.frame.io/reviews/abc/" → "app.frame.io/reviews/abc" */
export const shortUrl = (url: string) => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "9 Frame.io links · 11 Drive links · 5 clients" */
export function linkCounts(clients: { links: { kind: LinkKind }[] }[]) {
  const count = (kind: LinkKind) => clients.reduce((n, c) => n + c.links.filter((link) => link.kind === kind).length, 0);
  return [plural(count("frameio"), "Frame.io link", "Frame.io links"), plural(count("drive"), "Drive link", "Drive links"), plural(clients.length, "client", "clients")].join(" · ");
}
