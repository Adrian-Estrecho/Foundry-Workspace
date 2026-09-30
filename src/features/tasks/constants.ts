import type { StageInfo, StatusDef } from "@/features/statuses/constants";
import type { Enums } from "@/types/database";

/** A task's stage. Each workspace's own statuses sit in these, and behave like them. */
export type TaskStatus = Enums<"task_status">;
export type TaskPriority = Enums<"task_priority">;
/** One of the workspace's task statuses. */
export type TaskStatusDef = StatusDef<TaskStatus>;

/** The fixed stages, in board order. */
export const TASK_STAGES: StageInfo<TaskStatus>[] = [
  { value: "todo", label: "To Do", hint: "Not started yet." },
  { value: "in_progress", label: "In Progress", hint: "Being worked on." },
  { value: "for_review", label: "For Review", hint: "Handed in. Admins are notified to review it." },
  { value: "revisions", label: "Revisions", hint: "Sent back with feedback. Only admins move tasks here." },
  { value: "done", label: "Done", hint: "Finished. Only admins move tasks here, and editors can't reopen them." },
];

export const taskStageLabel = (stage: TaskStatus) => TASK_STAGES.find((s) => s.value === stage)?.label ?? stage;

/** Editors move their own work only this far; an admin decides Done or Revisions. */
export const EDITOR_STAGES: TaskStatus[] = ["todo", "in_progress", "for_review"];

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
