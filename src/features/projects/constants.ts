import type { StageInfo, StatusDef } from "@/features/statuses/constants";
import type { Enums } from "@/types/database";

/** A project's stage. Each workspace's own project statuses sit in these. */
export type ProjectStatus = Enums<"project_status">;
/** One of the workspace's project statuses. */
export type ProjectStatusDef = StatusDef<ProjectStatus>;

/** The fixed stages, in order. */
export const PROJECT_STAGES: StageInfo<ProjectStatus>[] = [
  { value: "brief_received", label: "Brief Received", hint: "New work, not started yet." },
  { value: "in_progress", label: "In Progress", hint: "The team is editing." },
  { value: "internal_review", label: "Internal Review", hint: "Checked by your team before the client sees it." },
  { value: "client_review", label: "Client Review", hint: "The client portal shows it as ready for their review." },
  { value: "revisions", label: "Revisions", hint: "Changes are being made." },
  { value: "delivered", label: "Delivered", hint: "Finished. Leaves the active project list." },
];

/** Suggestions for the deliverable spec fields (free text is allowed). */
export const FORMAT_SUGGESTIONS = ["MP4 H.264", "MP4 H.265", "ProRes 422", "ProRes 4444", "MOV"];
export const ASPECT_SUGGESTIONS = ["9:16", "16:9", "1:1", "4:5", "9:16 + 16:9"];
export const LENGTH_SUGGESTIONS = ["15s", "30s", "30–60s", "60–90s", "3–5 min", "10–15 min"];
