"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDaysIcon, KanbanSquareIcon, ListIcon, PlusIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RECENT_DONE_DAYS, TASK_VIEWS, type TaskView } from "../constants";
import { taskFiltersQuery, type TaskFilters } from "../filters";
import type { TaskFormOptions, TaskSummary } from "../queries";
import { TaskBoard } from "./task-board";
import { TaskCalendar } from "./task-calendar";
import { TaskFilterBar } from "./task-filters";
import { TaskList } from "./task-list";
import { TaskWorkload } from "./task-workload";
import { TaskWorkspace, useTaskWorkspace } from "./task-workspace";

const VIEW_ICONS: Record<TaskView, React.ComponentType<{ className?: string }>> = {
  board: KanbanSquareIcon,
  list: ListIcon,
  calendar: CalendarDaysIcon,
  editors: UsersIcon,
};

/** The admin's Tasks page: four views over the same filters, all kept in the URL. */
export function TaskViews({
  tasks,
  filters,
  options,
  today,
  month,
  counts,
}: {
  tasks: TaskSummary[];
  filters: TaskFilters;
  options: TaskFormOptions;
  today: string;
  month: string;
  counts: { open: number; overdue: number; forReview: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();

  const navigate = (patch: Partial<TaskFilters>) =>
    startTransition(() => router.replace(`${pathname}${taskFiltersQuery({ ...filters, ...patch })}`, { scroll: false }));

  return (
    <TaskWorkspace isAdmin today={today} options={options}>
      <PageHeader
        title="Tasks"
        description={
          <>
            {counts.open} open ·{" "}
            <Link href={`/tasks${taskFiltersQuery({ view: "list", due: "overdue" })}`} className={cn("hover:underline", counts.overdue > 0 && "text-danger")}>
              {counts.overdue} overdue
            </Link>{" "}
            ·{" "}
            <Link href={`/tasks${taskFiltersQuery({ view: "list", status: "for_review" })}`} className="hover:underline">
              {counts.forReview} waiting for review
            </Link>
          </>
        }
        actions={<NewTaskButton filters={filters} />}
      />

      <nav aria-label="Task views" className="mb-4 inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-0.5 scrollbar-none">
        {TASK_VIEWS.map((view) => {
          const Icon = VIEW_ICONS[view.value];
          const active = view.value === filters.view;
          return (
            <Link
              key={view.value}
              href={`${pathname}${taskFiltersQuery({ ...filters, view: view.value })}`}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {view.label}
            </Link>
          );
        })}
      </nav>

      <TaskFilterBar filters={filters} options={options} onChange={navigate} hide={filters.view === "calendar" ? ["due"] : []} />

      <div className={cn("transition-opacity", pending && "opacity-60")} aria-busy={pending}>
        {filters.view === "board" && (
          <>
            <TaskBoard tasks={tasks} emptyText={filters.q || filters.editor || filters.project ? "No matches" : undefined} />
            {!filters.status && (
              <p className="-mt-3 text-xs text-muted-foreground">Done shows tasks completed in the last {RECENT_DONE_DAYS} days.</p>
            )}
          </>
        )}
        {filters.view === "list" && <TaskList tasks={tasks} />}
        {filters.view === "calendar" && <TaskCalendar tasks={tasks} month={month} onMonthChange={(m) => navigate({ month: m })} />}
        {filters.view === "editors" && <TaskWorkload tasks={tasks} editors={options.editors} />}
      </div>
    </TaskWorkspace>
  );
}

/** Starts from the current filters: filtering by a project or editor pre-fills them. */
function NewTaskButton({ filters }: { filters: TaskFilters }) {
  const workspace = useTaskWorkspace();
  return (
    <Button
      onClick={() =>
        workspace.newTask({
          projectId: filters.project,
          assigneeId: filters.editor === "none" ? null : filters.editor,
          status: filters.status ?? undefined,
          priority: filters.priority ?? undefined,
        })
      }
    >
      <PlusIcon /> New task
    </Button>
  );
}
