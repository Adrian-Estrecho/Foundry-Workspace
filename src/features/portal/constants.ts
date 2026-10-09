/**
 * The portal's lists. Videos has every video. The others hold the videos
 * whose status on the team's board has that name, so they follow the board
 * as the team moves work (in ReEdit or ClickUp).
 */
export const PORTAL_LISTS = [
  { value: "videos", label: "Videos", statuses: null },
  { value: "ready-to-post", label: "Ready to post", statuses: ["ready to post"] },
  { value: "posted", label: "Posted", statuses: ["posted"] },
  { value: "archived", label: "Archived", statuses: ["archived", "archive"] },
] as const;

export type PortalListDef = (typeof PORTAL_LISTS)[number];
export type PortalListView = PortalListDef["value"];
export type PortalView = PortalListView | "board" | "messages";

/** Whether a status belongs in a list, whatever its case or spacing. */
export const inPortalList = (list: PortalListDef, statusName: string) =>
  list.statuses === null || (list.statuses as readonly string[]).includes(statusName.trim().replace(/\s+/g, " ").toLowerCase());

/** The tabs of the portal's view switcher. Messages sits apart, as an icon at the end of the row. */
export const PORTAL_TABS: { value: Exclude<PortalView, "messages">; label: string }[] = [...PORTAL_LISTS, { value: "board", label: "Board" }];

export const PORTAL_VIEWS: readonly PortalView[] = [...PORTAL_TABS.map((tab) => tab.value), "messages"];

/** Portal links are 32–64 URL-safe characters. */
export const PORTAL_TOKEN = /^[A-Za-z0-9_-]{32,64}$/;
