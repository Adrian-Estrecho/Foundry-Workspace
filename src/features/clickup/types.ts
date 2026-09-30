import type { StatusColor } from "@/features/statuses/constants";
import type { TaskStatus } from "@/features/tasks/constants";

/** A ClickUp List in the picker. */
export type ClickUpListNode = { id: string; name: string; taskCount: number | null; linkedTo: string | null };

export type ClickUpTree = {
  spaces: { id: string; name: string; folders: { id: string; name: string; lists: ClickUpListNode[] }[]; lists: ClickUpListNode[] }[];
};

/** A List's statuses, with the stage each gets here. `fixed`: it already has a status here, so its stage is set. */
export type ListSetup = {
  list: { id: string; name: string };
  statuses: { name: string; label: string; type: string; color: StatusColor; stage: TaskStatus; fixed: boolean }[];
  /** Statuses here that don't come from ClickUp. */
  otherStatuses: string[];
};

/** ClickUp's status groups, in the words ClickUp uses. */
export const CLICKUP_STATUS_TYPES: Record<string, string> = {
  open: "Not started",
  unstarted: "Not started",
  custom: "Active",
  done: "Done",
  closed: "Closed",
};

/** "ready to edit" → "Ready to edit" (workspace status names are at most 40 characters). */
export const statusLabel = (name: string) => (name.charAt(0).toUpperCase() + name.slice(1)).slice(0, 40).trim();
