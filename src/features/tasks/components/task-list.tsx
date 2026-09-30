"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, CheckSquareIcon, GraduationCapIcon, ListTodoIcon, MessageSquareIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import { priorityRank } from "../constants";
import type { TaskSummary } from "../queries";
import { DueChip, PriorityFlag, TaskStatusChip } from "./task-bits";
import { taskContext } from "./task-card";
import { TaskMenu, taskHref } from "./task-menu";
import { useTaskWorkspace } from "./task-workspace";

type SortKey = "title" | "assignee" | "status" | "priority" | "due";

/** Sorts by `key`; statuses sort in the workspace's order (`statusOrder`: status id to index). */
function compare(a: TaskSummary, b: TaskSummary, key: SortKey, statusOrder: Map<string, number>) {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title);
    case "assignee":
      return (a.assignee?.name ?? "~").localeCompare(b.assignee?.name ?? "~");
    case "status":
      return (statusOrder.get(a.statusInfo.id) ?? 0) - (statusOrder.get(b.statusInfo.id) ?? 0);
    case "priority":
      return priorityRank(b.priority) - priorityRank(a.priority);
    case "due":
      // No due date sorts last either way round.
      if (a.dueDate === b.dueDate) return priorityRank(b.priority) - priorityRank(a.priority);
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
  }
}

/** Sortable table. On phones each row folds into a compact two-line item. */
export function TaskList({ tasks, showAssignee = true }: { tasks: TaskSummary[]; showAssignee?: boolean }) {
  const workspace = useTaskWorkspace();
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "due", dir: 1 });

  const sorted = React.useMemo(() => {
    const statusOrder = new Map(workspace.statuses.map((status, index) => [status.id, index]));
    const list = [...tasks].sort((a, b) => compare(a, b, sort.key, statusOrder) * sort.dir);
    // Tasks without a date stay at the bottom when sorting by due date.
    return sort.key === "due" && sort.dir === -1 ? [...list.filter((t) => t.dueDate), ...list.filter((t) => !t.dueDate)] : list;
  }, [tasks, sort, workspace.statuses]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState icon={ListTodoIcon} title="No tasks match" description="Try clearing a filter." />
      </div>
    );
  }

  const header = (key: SortKey, label: string, className?: string) => {
    const active = sort.key === key;
    return (
      <th scope="col" className={cn("px-3 py-2.5 font-medium", className)} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : 1 }))}
          className={cn("inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", active && "text-foreground")}
        >
          {label}
          {active && (sort.dir === 1 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
        </button>
      </th>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full table-fixed text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            {header("title", "Task")}
            {showAssignee && header("assignee", "Assignee", "hidden w-44 lg:table-cell")}
            {header("status", "Status", "hidden w-36 md:table-cell")}
            {header("priority", "Priority", "hidden w-28 md:table-cell")}
            {header("due", "Due", "hidden w-32 sm:table-cell")}
            <th scope="col" className="w-12 px-3 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((task) => {
            const done = task.status === "done";
            return (
              <tr key={task.id} className="group transition-colors hover:bg-accent/40">
                <td className="px-3 py-2.5">
                  <Link href={taskHref(task, workspace.access.manage)} className="block min-w-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className={cn("block truncate font-medium", done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                      {task.title}
                    </span>
                    <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {task.isTrial && <GraduationCapIcon className="size-3 shrink-0 text-primary" />}
                      <span className="truncate">{taskContext(task)}</span>
                      {task.subtasks.total > 0 && (
                        <span className="ml-1.5 inline-flex shrink-0 items-center gap-0.5 tabular">
                          <CheckSquareIcon className="size-3" /> {task.subtasks.done}/{task.subtasks.total}
                        </span>
                      )}
                      {task.comments > 0 && (
                        <span className="ml-1.5 inline-flex shrink-0 items-center gap-0.5 tabular">
                          <MessageSquareIcon className="size-3" /> {task.comments}
                        </span>
                      )}
                    </span>
                    {/* Folded details for small screens. */}
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 md:hidden">
                      <TaskStatusChip status={task.statusInfo} />
                      <PriorityFlag priority={task.priority} />
                      <DueChip dueDate={task.dueDate} today={workspace.today} done={done} className="sm:hidden" />
                      {showAssignee && task.assignee && <span className="text-xs text-muted-foreground">{task.assignee.name}</span>}
                    </span>
                  </Link>
                </td>
                {showAssignee && (
                  <td className="hidden px-3 py-2.5 lg:table-cell">
                    {task.assignee ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <UserAvatar name={task.assignee.name} src={task.assignee.avatarUrl} className="size-6" />
                        <span className="truncate">{task.assignee.name}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                )}
                <td className="hidden px-3 py-2.5 md:table-cell">
                  <TaskStatusChip status={task.statusInfo} />
                </td>
                <td className="hidden px-3 py-2.5 md:table-cell">
                  <PriorityFlag priority={task.priority} />
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  {task.dueDate ? (
                    <DueChip dueDate={task.dueDate} today={workspace.today} done={done} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-2.5 text-right">
                  <TaskMenu task={task} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
