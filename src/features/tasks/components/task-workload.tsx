"use client";

import * as React from "react";
import { PlusIcon, UserRoundXIcon } from "lucide-react";
import { KanbanBoard, type KanbanColumn } from "@/components/shared/kanban-board";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { addDays } from "@/lib/dates";
import { priorityRank } from "../constants";
import type { EditorChoice, TaskSummary } from "../queries";
import { TaskCard } from "./task-card";
import { TaskMenu, taskHref } from "./task-menu";
import { useTaskWorkspace } from "./task-workspace";

const UNASSIGNED = "none";

type WorkloadTask = TaskSummary & { column: string };

/** Soonest deadline first, no date last; ties go to the higher priority. */
function byUrgency(a: TaskSummary, b: TaskSummary) {
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }
  return priorityRank(b.priority) - priorityRank(a.priority);
}

/**
 * Workload: each editor's open tasks side by side. Drag a card to another
 * editor to reassign it (they're notified), or to Unassigned.
 */
export function TaskWorkload({ tasks, editors }: { tasks: TaskSummary[]; editors: EditorChoice[] }) {
  const workspace = useTaskWorkspace();
  const weekEnd = addDays(workspace.today, 6);

  // Order within a column is by urgency, not stored: position is the rank.
  const items = React.useMemo<WorkloadTask[]>(
    () =>
      [...tasks].sort(byUrgency).map((task, index) => ({ ...task, column: task.assignee?.id ?? UNASSIGNED, position: index })),
    [tasks],
  );

  const people = editors.filter((e) => e.isActive || items.some((t) => t.column === e.id));
  const columns: KanbanColumn[] = [
    ...people.map((editor) => {
      const mine = items.filter((t) => t.column === editor.id);
      const overdue = mine.filter((t) => t.dueDate && t.dueDate < workspace.today).length;
      const thisWeek = mine.filter((t) => t.dueDate && t.dueDate >= workspace.today && t.dueDate <= weekEnd).length;
      return {
        id: editor.id,
        label: editor.name + (editor.isActive ? "" : " (inactive)"),
        icon: <UserAvatar name={editor.name} src={editor.avatarUrl} className="size-6" />,
        meta: (
          <span className="text-muted-foreground">
            {overdue > 0 && <span className="font-medium text-danger">{overdue} overdue</span>}
            {overdue > 0 && thisWeek > 0 && " · "}
            {thisWeek > 0 && `${thisWeek} due this week`}
            {overdue === 0 && thisWeek === 0 && (mine.length ? "Nothing due this week" : "Free")}
          </span>
        ),
        action: (
          <Button
            variant="ghost"
            size="icon-xs"
            className="rounded-full text-muted-foreground"
            aria-label={`New task for ${editor.name}`}
            onClick={() => workspace.newTask({ assigneeId: editor.id })}
          >
            <PlusIcon />
          </Button>
        ),
      };
    }),
    {
      id: UNASSIGNED,
      label: "Unassigned",
      meta: <span className="text-muted-foreground">Drop a task here to unassign it</span>,
      icon: (
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted">
          <UserRoundXIcon className="size-3.5 text-muted-foreground" />
        </span>
      ),
    },
  ];

  const onMove = async (task: WorkloadTask, column: string) => {
    // Reordering inside a column changes nothing: the order is by urgency.
    if (column === task.column) return true;
    const editor = editors.find((e) => e.id === column);
    return workspace.assign(task, editor?.id ?? null, editor?.name ?? "");
  };

  return (
    <KanbanBoard
      ariaLabel="Workload by editor"
      columns={columns}
      items={items}
      onMove={onMove}
      itemLabel={(task) => task.title}
      emptyText="No open tasks"
      renderCard={(task, { overlay }) => (
        <TaskCard
          task={task}
          today={workspace.today}
          href={taskHref(task, workspace.access.manage)}
          show="status"
          overlay={overlay}
          menu={overlay ? null : <TaskMenu task={task} />}
        />
      )}
    />
  );
}
