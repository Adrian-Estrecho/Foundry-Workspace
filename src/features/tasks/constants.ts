import type { Enums } from "@/types/database";

export type TaskStatus = Enums<"task_status">;
export type TaskPriority = Enums<"task_priority">;

/** Board columns, in order. `dot` colours the column marker and status chips. */
export const TASK_STATUSES: { value: TaskStatus; label: string; dot: string; chip: string }[] = [
  { value: "todo", label: "To Do", dot: "bg-muted-foreground", chip: "bg-muted text-muted-foreground ring-border" },
  { value: "in_progress", label: "In Progress", dot: "bg-status-online", chip: "bg-status-online/12 text-status-online ring-status-online/25" },
  { value: "for_review", label: "For Review", dot: "bg-warning", chip: "bg-warning/12 text-warning ring-warning/25" },
  { value: "revisions", label: "Revisions", dot: "bg-danger", chip: "bg-danger/10 text-danger ring-danger/25" },
  { value: "done", label: "Done", dot: "bg-success", chip: "bg-success/12 text-success ring-success/25" },
];

export const taskStatusMeta = (status: TaskStatus) => TASK_STATUSES.find((s) => s.value === status) ?? TASK_STATUSES[0];

/** Editors move their own work only this far; an admin decides Done or Revisions. */
export const EDITOR_STATUSES: TaskStatus[] = ["todo", "in_progress", "for_review"];

export const TASK_PRIORITIES: { value: TaskPriority; label: string; rank: number }[] = [
  { value: "urgent", label: "Urgent", rank: 4 },
  { value: "high", label: "High", rank: 3 },
  { value: "medium", label: "Medium", rank: 2 },
  { value: "low", label: "Low", rank: 1 },
];

export const priorityRank = (priority: TaskPriority) => TASK_PRIORITIES.find((p) => p.value === priority)?.rank ?? 0;

/** Done tasks stay on the board and list this long, unless you filter for Done. */
export const RECENT_DONE_DAYS = 14;

export const TASK_VIEWS = [
  { value: "board", label: "Kanban" },
  { value: "list", label: "List" },
  { value: "calendar", label: "Calendar" },
  { value: "editors", label: "By Editor" },
] as const;

export type TaskView = (typeof TASK_VIEWS)[number]["value"];

export const DUE_FILTERS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Next 7 days" },
  { value: "none", label: "No due date" },
] as const;

export type DueFilter = (typeof DUE_FILTERS)[number]["value"];

export const MAX_TASK_FILE_BYTES = 100 * 1024 * 1024;
