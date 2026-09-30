import { Constants } from "@/types/database";
import { DUE_FILTERS, TASK_VIEWS, type DueFilter, type TaskPriority, type TaskView } from "./constants";

/**
 * Task filters live in the URL (/tasks?view=list&editor=…&due=overdue), so
 * every view is linkable and survives a refresh. Unknown values are ignored.
 */
export type TaskFilters = {
  view: TaskView;
  /** An editor's id, or "none" for unassigned. */
  editor: string | null;
  client: string | null;
  project: string | null;
  /** One of the workspace's statuses (its id), or a whole stage, e.g. "for_review". */
  status: string | null;
  priority: TaskPriority | null;
  due: DueFilter | null;
  q: string;
  /** Calendar month, YYYY-MM. */
  month: string | null;
};

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string | null): value is string => Boolean(value && UUID.test(value));

function pick(params: Params, key: string) {
  const value = params instanceof URLSearchParams ? params.get(key) : params[key];
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

function oneOf<T extends string>(value: string | null, options: readonly T[]) {
  return options.includes(value as T) ? (value as T) : null;
}

export function parseTaskFilters(params: Params): TaskFilters {
  const editor = pick(params, "editor");
  const month = pick(params, "month");
  const status = pick(params, "status");
  return {
    view: oneOf(pick(params, "view"), TASK_VIEWS.map((v) => v.value)) ?? "board",
    editor: editor === "none" || isUuid(editor) ? editor : null,
    client: isUuid(pick(params, "client")) ? pick(params, "client") : null,
    project: isUuid(pick(params, "project")) ? pick(params, "project") : null,
    status: isUuid(status) ? status : oneOf(status, Constants.public.Enums.task_status),
    priority: oneOf(pick(params, "priority"), Constants.public.Enums.task_priority),
    due: oneOf(pick(params, "due"), DUE_FILTERS.map((d) => d.value)),
    q: (pick(params, "q") ?? "").trim().slice(0, 100),
    month: month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null,
  };
}

/** The query string for a set of filters, leaving out defaults. */
export function taskFiltersQuery(filters: Partial<TaskFilters>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (!value || (key === "view" && value === "board")) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** How many filters narrow the tasks (view and month don't count). */
export const activeFilterCount = (filters: TaskFilters) =>
  [filters.editor, filters.client, filters.project, filters.status, filters.priority, filters.due, filters.q].filter(Boolean)
    .length;
