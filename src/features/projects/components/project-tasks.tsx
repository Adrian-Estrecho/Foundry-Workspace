"use client";

import * as React from "react";
import Link from "next/link";
import { ListTodoIcon, PlusIcon, SearchIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { Segmented } from "@/components/shared/segmented";
import { StatusFilter } from "@/components/shared/status-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClickUpMark } from "@/features/clickup/components/clickup-mark";
import { statusColor } from "@/features/statuses/constants";
import type { TaskAccess } from "@/features/tasks/access";
import type { TaskStatusDef } from "@/features/tasks/constants";
import type { TaskFormOptions, TaskSummary } from "@/features/tasks/queries";
import { TaskBoard } from "@/features/tasks/components/task-board";
import { TaskList } from "@/features/tasks/components/task-list";
import { TaskStatusesButton, TaskWorkspace, useTaskWorkspace } from "@/features/tasks/components/task-workspace";

/**
 * The project's tasks as a board or a list. Editors see only their own.
 * Search and the status filter narrow both views; filtering by status also
 * hides the other board columns.
 */
export function ProjectTasks({
  projectId,
  tasks,
  access,
  today,
  options,
  statuses,
}: {
  projectId: string;
  tasks: TaskSummary[];
  access: TaskAccess;
  today: string;
  options: TaskFormOptions | null;
  statuses: TaskStatusDef[];
}) {
  const [view, setView] = React.useState<"board" | "list">("board");
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const open = tasks.filter((t) => t.status !== "done").length;

  // Statuses deleted since they were picked drop out of the filter.
  const shownStatuses = React.useMemo(
    () => statusFilter.filter((id) => statuses.some((s) => s.id === id)),
    [statusFilter, statuses],
  );
  const q = query.trim().toLowerCase();
  const filtering = q !== "" || shownStatuses.length > 0;
  // Memoised: a new array resets the board, which would undo a drop in flight.
  const matching = React.useMemo(
    () =>
      tasks.filter(
        (t) =>
          (shownStatuses.length === 0 || shownStatuses.includes(t.statusInfo.id)) &&
          (!q || t.title.toLowerCase().includes(q) || Boolean(t.assignee?.name.toLowerCase().includes(q))),
      ),
    [tasks, q, shownStatuses],
  );
  // Fed by a ClickUp List: tasks are added in ClickUp.
  const fromClickUp = options?.projects.find((p) => p.id === projectId)?.clickup ?? false;
  const addTask = (label?: string) =>
    fromClickUp ? (
      <Button asChild variant="secondary" className="bg-surface ring-1 ring-border">
        <Link href="/workspace/clickup">
          <ClickUpMark /> Synced from ClickUp
        </Link>
      </Button>
    ) : (
      <NewTask projectId={projectId} label={label} />
    );

  return (
    <TaskWorkspace access={access} today={today} options={options} statuses={statuses}>
      <section aria-labelledby="project-tasks" className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 id="project-tasks" className="mr-auto font-heading text-lg font-medium">
            {access.manage ? "Tasks" : "Your tasks"}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {open} open · {tasks.length - open} done
            </span>
          </h2>
          {tasks.length > 0 && (
            <>
              <div className="relative w-full sm:w-56">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tasks"
                  aria-label="Search tasks"
                  className="h-9 rounded-full bg-card pl-9"
                />
              </div>
              <StatusFilter
                value={statusFilter}
                onChange={setStatusFilter}
                options={statuses.map((status) => ({
                  id: status.id,
                  label: status.name,
                  dot: statusColor(status.color).dot,
                  count: tasks.filter((t) => t.statusInfo.id === status.id).length,
                }))}
              />
            </>
          )}
          <Segmented
            label="Task view"
            value={view}
            onChange={setView}
            options={[
              { value: "board", label: "Board" },
              { value: "list", label: "List" },
            ]}
          />
          <TaskStatusesButton />
          {access.manage && addTask()}
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EmptyState
              icon={ListTodoIcon}
              title="No tasks yet"
              description={
                access.manage
                  ? fromClickUp
                    ? "Tasks show up here when they reach the start status in ClickUp."
                    : "Break the project into tasks and assign them to editors."
                  : "Tasks assigned to you on this project show up here."
              }
              action={access.manage ? addTask("Add the first task") : undefined}
            />
          </div>
        ) : view === "board" ? (
          <TaskBoard
            tasks={matching}
            draft={{ projectId }}
            addTasks={!fromClickUp}
            only={shownStatuses}
            emptyText={filtering ? "No matches" : undefined}
          />
        ) : (
          <TaskList tasks={matching} />
        )}
      </section>
    </TaskWorkspace>
  );
}

function NewTask({ projectId, label = "New task" }: { projectId: string; label?: string }) {
  const workspace = useTaskWorkspace();
  return (
    <Button onClick={() => workspace.newTask({ projectId })}>
      <PlusIcon /> {label}
    </Button>
  );
}
