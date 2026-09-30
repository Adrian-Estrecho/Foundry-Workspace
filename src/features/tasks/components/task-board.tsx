"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";
import { KanbanBoard, type KanbanColumn } from "@/components/shared/kanban-board";
import { Button } from "@/components/ui/button";
import { statusColor } from "@/features/statuses/constants";
import type { TaskSummary } from "../queries";
import { TaskCard } from "./task-card";
import type { TaskDraft } from "./task-form-dialog";
import { TaskMenu, taskHref } from "./task-menu";
import { useTaskWorkspace } from "./task-workspace";

type BoardTask = TaskSummary & { column: string };

/**
 * Kanban with a column per status, in the workspace's order (To Do → … →
 * Done by default). Admins can drop anywhere (entering Revisions asks what to
 * change) and add statuses; editors move their own tasks up to the For
 * Review stage. `addTasks` is off where tasks are added elsewhere (a
 * project synced from ClickUp).
 */
export function TaskBoard({
  tasks,
  draft,
  emptyText,
  addTasks = true,
}: {
  tasks: TaskSummary[];
  draft?: TaskDraft;
  emptyText?: string;
  addTasks?: boolean;
}) {
  const workspace = useTaskWorkspace();
  const items = React.useMemo<BoardTask[]>(() => tasks.map((task) => ({ ...task, column: task.statusInfo.id })), [tasks]);

  const columns: KanbanColumn[] = workspace.statuses.map((status) => ({
    id: status.id,
    label: status.name,
    dot: statusColor(status.color).dot,
    action:
      workspace.access.manage && addTasks && status.stage !== "done" ? (
        <Button
          variant="ghost"
          size="icon-xs"
          className="rounded-full text-muted-foreground"
          aria-label={`New task in ${status.name}`}
          onClick={() => workspace.newTask({ ...draft, statusId: status.id })}
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
      onMove={(task, column, position) => {
        const target = workspace.statuses.find((s) => s.id === column);
        return target ? workspace.dropOnStatus(task, target, position) : Promise.resolve(false);
      }}
      itemLabel={(task) => task.title}
      emptyText={emptyText ?? (workspace.access.manage ? "Drag a task here" : "Nothing here")}
      renderCard={(task, { overlay }) => (
        <TaskCard
          task={task}
          today={workspace.today}
          href={taskHref(task, workspace.access.manage)}
          overlay={overlay}
          menu={overlay ? null : <TaskMenu task={task} />}
        />
      )}
      trailing={
        workspace.access.statuses ? (
          <button
            type="button"
            onClick={() => workspace.addStatus()}
            className="flex h-28 w-[82vw] max-w-80 shrink-0 snap-start items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors outline-none hover:border-foreground/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:mt-10 sm:w-56"
          >
            <PlusIcon className="size-4" /> Add status
          </button>
        ) : undefined
      }
    />
  );
}
