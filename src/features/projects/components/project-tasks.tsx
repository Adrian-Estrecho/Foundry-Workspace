"use client";

import * as React from "react";
import { ListTodoIcon, PlusIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { RECENT_DONE_DAYS } from "@/features/tasks/constants";
import type { TaskFormOptions, TaskSummary } from "@/features/tasks/queries";
import { TaskBoard } from "@/features/tasks/components/task-board";
import { TaskList } from "@/features/tasks/components/task-list";
import { TaskWorkspace, useTaskWorkspace } from "@/features/tasks/components/task-workspace";

/**
 * The project's tasks as a board or a list. Editors see only their own. The
 * board's Done column keeps to recent work; the list has everything.
 */
export function ProjectTasks({
  projectId,
  tasks,
  isAdmin,
  today,
  doneSince,
  options,
}: {
  projectId: string;
  tasks: TaskSummary[];
  isAdmin: boolean;
  today: string;
  /** Done tasks completed before this (ISO time) stay off the board. */
  doneSince: string;
  options: TaskFormOptions | null;
}) {
  const [view, setView] = React.useState<"board" | "list">("board");
  const open = tasks.filter((t) => t.status !== "done").length;
  const onBoard = React.useMemo(
    () => tasks.filter((t) => t.status !== "done" || (t.completedAt ?? "") >= doneSince),
    [tasks, doneSince],
  );
  const olderDone = tasks.length - onBoard.length;

  return (
    <TaskWorkspace isAdmin={isAdmin} today={today} options={options}>
      <section aria-labelledby="project-tasks" className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 id="project-tasks" className="mr-auto font-heading text-lg font-medium">
            {isAdmin ? "Tasks" : "Your tasks"}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {open} open · {tasks.length - open} done
            </span>
          </h2>
          <Segmented
            label="Task view"
            value={view}
            onChange={setView}
            options={[
              { value: "board", label: "Board" },
              { value: "list", label: "List" },
            ]}
          />
          {isAdmin && <NewTask projectId={projectId} />}
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EmptyState
              icon={ListTodoIcon}
              title="No tasks yet"
              description={isAdmin ? "Break the project into tasks and assign them to editors." : "Tasks assigned to you on this project show up here."}
              action={isAdmin ? <NewTask projectId={projectId} label="Add the first task" /> : undefined}
            />
          </div>
        ) : view === "board" ? (
          <>
            <TaskBoard tasks={onBoard} draft={{ projectId }} />
            {olderDone > 0 && (
              <p className="-mt-3 text-xs text-muted-foreground">
                Done shows the last {RECENT_DONE_DAYS} days.{" "}
                <button type="button" onClick={() => setView("list")} className="font-medium text-foreground hover:underline">
                  See all {tasks.length - open} done in List
                </button>
              </p>
            )}
          </>
        ) : (
          <TaskList tasks={tasks} />
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
