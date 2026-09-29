import type { Enums } from "@/types/database";

/**
 * What the owner sees for an editor. Working / On break come from the
 * editor's own switch; Online / Offline come from presence (is ReEdit open?).
 */
export type LiveStatus = "working" | "on_break" | "online" | "offline";

export function liveStatus(workStatus: Enums<"work_status">, isOnline: boolean): LiveStatus {
  if (workStatus === "working") return "working";
  if (workStatus === "on_break") return "on_break";
  return isOnline ? "online" : "offline";
}

export const STATUS_META: Record<LiveStatus, { label: string; dot: string; chip: string }> = {
  working: {
    label: "Working",
    dot: "bg-status-working",
    chip: "bg-status-working/12 text-status-working ring-status-working/25",
  },
  on_break: {
    label: "On break",
    dot: "bg-status-break",
    chip: "bg-status-break/12 text-status-break ring-status-break/25",
  },
  online: {
    label: "Online",
    dot: "bg-status-online",
    chip: "bg-status-online/12 text-status-online ring-status-online/25",
  },
  offline: {
    label: "Offline",
    dot: "bg-status-offline",
    chip: "bg-status-offline/10 text-status-offline ring-status-offline/20",
  },
};

export const PRIORITY_META: Record<Enums<"task_priority">, { label: string; className: string }> = {
  low: { label: "Low", className: "text-muted-foreground" },
  medium: { label: "Medium", className: "text-status-online" },
  high: { label: "High", className: "text-warning" },
  urgent: { label: "Urgent", className: "text-danger" },
};

export const TASK_STATUS_LABEL: Record<Enums<"task_status">, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  for_review: "For Review",
  revisions: "Revisions",
  done: "Done",
};
