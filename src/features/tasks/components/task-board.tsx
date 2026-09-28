"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";
import { KanbanBoard, type KanbanColumn } from "@/components/shared/kanban-board";
import { Button } from "@/components/ui/button";
import { TASK_STATUSES, type TaskStatus } from "../constants";
import type { TaskSummary } from "../queries";
import { TaskCard } from "./task-card";
import type { TaskDraft } from "./task-form-dialog";
import { TaskMenu, taskHref } from "./task-menu";
import { useTaskWorkspace } from "./task-workspace";

type BoardTask = TaskSummary & { column: TaskStatus };

/**
 * Kanban by status: To Do → In Progress → For Review → Revisions → Done.
 * Admins can drop anywhere (Revisions asks what to change); editors move
 * their own tasks up to For Review.
 */
export function TaskBoard({ tasks, draft, emptyText }: { tasks: TaskSummary[]; draft?: TaskDraft; emptyText?: string }) {
  const workspace = useTaskWorkspace();
  const items = React.useMemo<BoardTask[]>(() => tasks.map((task) => ({ ...task, column: task.status })), [tasks]);

  const columns: KanbanColumn[] = TASK_STATUSES.map((status) => ({
    id: status.value,
    label: status.label,
    dot: status.dot,
    action:
      workspace.isAdmin && status.value !== "done" ? (
        <Button
          variant="ghost"
          size="icon-xs"
          className="rounded-full text-muted-foreground"
          aria-label={`New task in ${status.label}`}
          onClick={() => workspace.newTask({ ...draft, status: status.value })}
        >
          <PlusIcon />
        </Button>
      ) : undefined,
  }));

  return (
    <KanbanBoard
      ariaLabel="Task board"
      columns={columns}
      items={items}
      onMove={(task, column, position) => workspace.dropOnStatus(task, column as TaskStatus, position)}
      itemLabel={(task) => task.title}
      emptyText={emptyText ?? (workspace.isAdmin ? "Drag a task here" : "Nothing here")}
      renderCard={(task, { overlay }) => (
        <TaskCard
          task={task}
          today={workspace.today}
          href={taskHref(task, workspace.isAdmin)}
          overlay={overlay}
          menu={overlay ? null : <TaskMenu task={task} />}
        />
      )}
    />
  );
}
