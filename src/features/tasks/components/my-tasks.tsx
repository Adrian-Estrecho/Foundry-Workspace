"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CheckSquareIcon,
  ChevronDownIcon,
  GraduationCapIcon,
  ListTodoIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlayIcon,
  SendIcon,
} from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskAccess } from "../access";
import { MY_TASK_VIEWS, priorityRank, RECENT_DONE_DAYS, type TaskStatusDef } from "../constants";
import { activeFilterCount, taskFiltersQuery, type TaskFilters } from "../filters";
import type { TaskFormOptions, TaskSummary } from "../queries";
import { DueChip, PriorityFlag, TaskStatusChip } from "./task-bits";
import { TaskBoard } from "./task-board";
import { TaskCalendar } from "./task-calendar";
import { taskContext } from "./task-card";
import { TaskFilterBar } from "./task-filters";
import { TaskMenu, taskHref } from "./task-menu";
import { TaskViewNav } from "./task-views";
import { TaskStatusesButton, TaskWorkspace, useTaskWorkspace } from "./task-workspace";

const byDue = (a: TaskSummary, b: TaskSummary) =>
  (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || priorityRank(b.priority) - priorityRank(a.priority);

/**
 * An editor's own work, laid out like the Tasks page: the same Kanban,
 * filters (all but the editor one) and calendar. The list groups it into
 * overdue, today and upcoming, with the next step as a button.
 */
export function MyTasks({
  access,
  tasks,
  filters,
  options,
  statuses,
  today,
  month,
  counts,
}: {
  /** Their own tasks only, but abilities still apply (e.g. marking Done). */
  access: TaskAccess;
  tasks: TaskSummary[];
  filters: TaskFilters;
  /** For the client and project filters. */
  options: TaskFormOptions;
  statuses: TaskStatusDef[];
  today: string;
  month: string;
  counts: { open: number; dueToday: number; overdue: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();

  const navigate = (patch: Partial<TaskFilters>) =>
    startTransition(() => router.replace(`${pathname}${taskFiltersQuery({ ...filters, ...patch })}`, { scroll: false }));

  const filtering = activeFilterCount(filters) > 0;
  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).sort(byDue);
  const dueToday = open.filter((t) => t.dueDate === today).sort(byDue);
  const upcoming = open.filter((t) => !t.dueDate || t.dueDate > today).sort(byDue);
  const done = tasks.filter((t) => t.status === "done").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const thisWeek = upcoming.filter((t) => t.dueDate && t.dueDate <= addDays(today, 6));

  return (
    <TaskWorkspace access={access} today={today} options={null} statuses={statuses}>
      <PageHeader
        title="My Tasks"
        description={
          <>
            {counts.open} open ·{" "}
            <Link href={`/my-tasks${taskFiltersQuery({ view: "list", due: "today" })}`} className="hover:underline">
              {counts.dueToday} due today
            </Link>{" "}
            ·{" "}
            <Link
              href={`/my-tasks${taskFiltersQuery({ view: "list", due: "overdue" })}`}
              className={cn("hover:underline", counts.overdue > 0 && "text-danger")}
            >
              {counts.overdue} overdue
            </Link>
          </>
        }
        actions={<TaskStatusesButton />}
      />

      <TaskViewNav filters={filters} views={MY_TASK_VIEWS} />

      <TaskFilterBar
        filters={filters}
        options={options}
        statuses={statuses}
        onChange={navigate}
        hide={filters.view === "calendar" ? ["editor", "due"] : ["editor"]}
      />

      <div className={cn("transition-opacity", pending && "opacity-60")} aria-busy={pending}>
        {filters.view === "board" && (
          <>
            <TaskBoard tasks={tasks} emptyText={filtering ? "No matches" : undefined} />
            {!filters.status && (
              <p className="-mt-3 text-xs text-muted-foreground">Done shows tasks completed in the last {RECENT_DONE_DAYS} days.</p>
            )}
          </>
        )}
        {filters.view === "calendar" && <TaskCalendar tasks={tasks} month={month} onMonthChange={(m) => navigate({ month: m })} />}
        {filters.view === "list" &&
          (tasks.length === 0 ? (
            <div className="rounded-xl border bg-card">
              {filtering ? (
                <EmptyState icon={ListTodoIcon} title="No matches" description="None of your tasks match these filters." />
              ) : (
                <EmptyState icon={ListTodoIcon} title="No tasks yet" description="When your team assigns you work, it shows up here and you'll get a notification." />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {overdue.length > 0 && <Group label="Overdue" tone="danger" tasks={overdue} />}
              {(!filtering || dueToday.length > 0) && <Group label="Today" tasks={dueToday} empty="Nothing due today." />}
              {(!filtering || upcoming.length > 0) && (
                <Group
                  label="Upcoming"
                  hint={thisWeek.length ? `${thisWeek.length} due in the next 7 days` : undefined}
                  tasks={upcoming}
                  empty="Nothing else on your plate."
                />
              )}
              {done.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="group flex items-center gap-1.5 px-1 text-sm font-medium text-muted-foreground hover:text-foreground">
                    <ChevronDownIcon className="size-4 transition-transform group-data-[state=closed]:-rotate-90" />
                    Recently done · {done.length}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <ul className="grid grid-cols-1 gap-1.5">
                      {done.map((task) => (
                        <MyTaskRow key={task.id} task={task} />
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ))}
      </div>
    </TaskWorkspace>
  );
}

function Group({
  label,
  hint,
  tasks,
  tone,
  empty,
}: {
  label: string;
  hint?: string;
  tasks: TaskSummary[];
  tone?: "danger";
  empty?: string;
}) {
  return (
    <section aria-label={label} className={cn(tone === "danger" && "rounded-xl bg-danger/8 p-3 ring-1 ring-danger/25")}>
      <h2 className={cn("mb-2 px-1 text-sm font-medium", tone === "danger" ? "text-danger" : "text-muted-foreground")}>
        {label} · {tasks.length}
        {hint && <span className="font-normal"> · {hint}</span>}
      </h2>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5">
          {tasks.map((task) => (
            <MyTaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** One task with the next step as a button: Start, or Send for review. */
function MyTaskRow({ task }: { task: TaskSummary }) {
  const workspace = useTaskWorkspace();
  const [pending, startTransition] = React.useTransition();
  const done = task.status === "done";
  const next =
    task.isTrial
      ? null
      : task.status === "todo"
        ? { status: "in_progress" as const, label: "Start", icon: PlayIcon }
        : task.status === "in_progress" || task.status === "revisions"
          ? { status: "for_review" as const, label: "Send for review", icon: SendIcon }
          : null;

  return (
    <li className="group flex items-center gap-2 rounded-xl border bg-card pr-2 transition-colors hover:border-foreground/20">
      <Link href={taskHref(task, false)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm font-medium", done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
            {task.title}
          </span>
          <span className="flex items-center gap-2 truncate text-xs text-muted-foreground">
            {task.isTrial && <GraduationCapIcon className="size-3 shrink-0 text-primary" />}
            <span className="truncate">{taskContext(task)}</span>
            {task.subtasks.total > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 tabular">
                <CheckSquareIcon className="size-3" /> {task.subtasks.done}/{task.subtasks.total}
              </span>
            )}
            {task.comments > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 tabular">
                <MessageSquareIcon className="size-3" /> {task.comments}
              </span>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 sm:hidden">
            <TaskStatusChip status={task.statusInfo} />
            <DueChip dueDate={task.dueDate} today={workspace.today} done={done} />
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-3 sm:flex">
          <PriorityFlag priority={task.priority} />
          <TaskStatusChip status={task.statusInfo} />
          <span className="w-24 text-right">
            <DueChip dueDate={task.dueDate} today={workspace.today} done={done} />
          </span>
        </span>
      </Link>
      {next && (
        <Button
          size="sm"
          variant={next.status === "for_review" ? "default" : "secondary"}
          className={cn("shrink-0", next.status !== "for_review" && "bg-surface-strong ring-1 ring-border")}
          disabled={pending}
          onClick={() => startTransition(async () => void (await workspace.changeStatus(task, next.status)))}
          aria-label={`${next.label}: ${task.title}`}
        >
          {pending ? <Loader2Icon className="animate-spin" /> : <next.icon />}
          <span className="hidden md:inline">{next.label}</span>
        </Button>
      )}
      <TaskMenu task={task} />
    </li>
  );
}
