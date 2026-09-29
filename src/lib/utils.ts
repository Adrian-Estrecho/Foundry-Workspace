export { cn } from "cn";

/**
 * Only allow same-site relative redirects (e.g. "/tasks?view=list").
 * Anything else, including protocol-relative "//evil.com", falls back.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** "Maya Chen" → "MC" */
export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** First name for greetings. */
export function firstName(name: string | null | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] || "there";
}

/**
 * A one-to-one embed. PostgREST returns it as an object, but the generated
 * types call it an array when the foreign key is composite (per-workspace
 * rows), so accept both.
 */
export function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
