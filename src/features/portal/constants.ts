import type { StatusColor } from "@/features/statuses/constants";

/** The tabs of the portal's view switcher. Messages sits apart, as an icon at the end of the row. */
export const PORTAL_TABS = [
  { value: "overview", label: "Overview" },
  { value: "board", label: "Board" },
  { value: "list", label: "List" },
  { value: "calendar", label: "Calendar" },
] as const;

export type PortalView = (typeof PORTAL_TABS)[number]["value"] | "messages";

export const PORTAL_VIEWS: readonly PortalView[] = [...PORTAL_TABS.map((tab) => tab.value), "messages"];

/**
 * The statuses clients see on the board and in the list, in place of the
 * team's whole pipeline. Ready to post, Posted and Archived hold the videos
 * whose status on the team's board has that name, so they follow the board.
 * Videos holds every other video: the ones still being made.
 */
export const CLIENT_STATUSES = [
  { value: "videos", label: "Videos", color: "blue", names: [] },
  { value: "ready-to-post", label: "Ready to post", color: "teal", names: ["ready to post"] },
  { value: "posted", label: "Posted", color: "green", names: ["posted"] },
  { value: "archived", label: "Archived", color: "grey", names: ["archived", "archive"] },
] as const satisfies readonly { value: string; label: string; color: StatusColor; names: readonly string[] }[];

export type ClientStatus = (typeof CLIENT_STATUSES)[number]["value"];

/** The client status for a status on the team's board, whatever its case or spacing. */
export function clientStatusOf(statusName: string): ClientStatus {
  const name = statusName.trim().replace(/\s+/g, " ").toLowerCase();
  return CLIENT_STATUSES.find((status) => (status.names as readonly string[]).includes(name))?.value ?? "videos";
}

/** The list's status filter, from `?status=posted,archived`. Empty means every status. */
export function parseStatusFilter(value: string | null | undefined): ClientStatus[] {
  const wanted = new Set(value?.split(","));
  return CLIENT_STATUSES.filter((status) => wanted.has(status.value)).map((status) => status.value);
}

/** Portal links are 32–64 URL-safe characters. */
export const PORTAL_TOKEN = /^[A-Za-z0-9_-]{32,64}$/;
