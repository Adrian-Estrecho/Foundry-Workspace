import type { Enums } from "@/types/database";

/** How task statuses read to a client (For Review is our own quality check). */
export const PORTAL_TASK_STATUSES: { value: Enums<"task_status">; label: string; dot: string; chip: string }[] = [
  { value: "todo", label: "Up next", dot: "bg-muted-foreground", chip: "bg-muted text-muted-foreground ring-border" },
  { value: "in_progress", label: "In progress", dot: "bg-status-online", chip: "bg-status-online/12 text-status-online ring-status-online/25" },
  { value: "for_review", label: "Quality check", dot: "bg-warning", chip: "bg-warning/12 text-warning ring-warning/25" },
  { value: "revisions", label: "Revising", dot: "bg-danger", chip: "bg-danger/10 text-danger ring-danger/25" },
  { value: "done", label: "Done", dot: "bg-success", chip: "bg-success/12 text-success ring-success/25" },
];

export const portalStatus = (status: Enums<"task_status">) =>
  PORTAL_TASK_STATUSES.find((s) => s.value === status) ?? PORTAL_TASK_STATUSES[0];

/** Project stages, as a client would say them. */
export const PORTAL_PROJECT_STATUS: Record<Enums<"project_status">, string> = {
  brief_received: "Brief received",
  in_progress: "In progress",
  internal_review: "Quality check",
  client_review: "Ready for your review",
  revisions: "Revising",
  delivered: "Delivered",
};

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
