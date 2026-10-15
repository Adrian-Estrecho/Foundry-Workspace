/** A client's links: their main Drive folder and their projects' Frame.io links. */

export type LinkKind = "frameio" | "drive";

export const LINK_KINDS: { value: LinkKind; label: string }[] = [
  { value: "frameio", label: "Frame.io" },
  { value: "drive", label: "Drive" },
];

/** "https://app.frame.io/reviews/abc/" → "app.frame.io/reviews/abc" */
export const shortUrl = (url: string) => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "4 Frame.io links · 3 Drive folders · 5 clients" */
export function linkCounts(clients: { links: { kind: LinkKind }[] }[]) {
  const count = (kind: LinkKind) => clients.reduce((n, c) => n + c.links.filter((link) => link.kind === kind).length, 0);
  return [plural(count("frameio"), "Frame.io link", "Frame.io links"), plural(count("drive"), "Drive folder", "Drive folders"), plural(clients.length, "client", "clients")].join(" · ");
}
