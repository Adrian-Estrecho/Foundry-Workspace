import type { CurrentUser } from "@/lib/auth";

/**
 * What someone may do with tasks, from their abilities. Owners and admins
 * can do everything; editors work on their own tasks unless given more.
 * Test edits follow hiring (editors.manage) instead of task management.
 */
export type TaskAccess = {
  /** Create, edit, assign, reschedule and delete tasks; see everyone's. */
  manage: boolean;
  /** Move to any status, Done and Revisions included, and reopen finished work. */
  anyStatus: boolean;
  /** Add, edit and reorder the workspace's task statuses. */
  statuses: boolean;
  /** Open editor profiles. */
  editors: boolean;
};

export const EDITOR_TASK_ACCESS: TaskAccess = { manage: false, anyStatus: false, statuses: false, editors: false };

export function taskAccess(user: Pick<CurrentUser, "permissions">, { trial = false } = {}): TaskAccess {
  const has = (key: CurrentUser["permissions"][number]) => user.permissions.includes(key);
  return {
    manage: trial ? has("editors.manage") : has("tasks.manage"),
    anyStatus: trial ? has("editors.manage") : has("tasks.status"),
    statuses: has("statuses.manage"),
    editors: has("editors.manage"),
  };
}
