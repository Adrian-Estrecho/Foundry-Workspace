import type { Enums } from "@/types/database";

export type ProjectStatus = Enums<"project_status">;

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; dot: string }[] = [
  { value: "brief_received", label: "Brief Received", dot: "bg-status-online" },
  { value: "in_progress", label: "In Progress", dot: "bg-primary" },
  { value: "internal_review", label: "Internal Review", dot: "bg-warning" },
  { value: "client_review", label: "Client Review", dot: "bg-warning" },
  { value: "revisions", label: "Revisions", dot: "bg-danger" },
  { value: "delivered", label: "Delivered", dot: "bg-success" },
];

export const projectStatusMeta = (status: ProjectStatus) =>
  PROJECT_STATUSES.find((s) => s.value === status) ?? PROJECT_STATUSES[0];

/** Suggestions for the deliverable spec fields (free text is allowed). */
export const FORMAT_SUGGESTIONS = ["MP4 H.264", "MP4 H.265", "ProRes 422", "ProRes 4444", "MOV"];
export const ASPECT_SUGGESTIONS = ["9:16", "16:9", "1:1", "4:5", "9:16 + 16:9"];
export const LENGTH_SUGGESTIONS = ["15s", "30s", "30–60s", "60–90s", "3–5 min", "10–15 min"];
