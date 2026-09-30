/** The tabs of the portal's view switcher. Messages sits apart, as an icon at the end of the row. */
export const PORTAL_TABS = [
  { value: "overview", label: "Overview" },
  { value: "board", label: "Board" },
  { value: "list", label: "List" },
  { value: "calendar", label: "Calendar" },
] as const;

export type PortalView = (typeof PORTAL_TABS)[number]["value"] | "messages";

export const PORTAL_VIEWS: readonly PortalView[] = [...PORTAL_TABS.map((tab) => tab.value), "messages"];

/** Portal links are 32–64 URL-safe characters. */
export const PORTAL_TOKEN = /^[A-Za-z0-9_-]{32,64}$/;
