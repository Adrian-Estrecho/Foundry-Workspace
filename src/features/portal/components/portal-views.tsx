"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CheckSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  ListTodoIcon,
  LoaderIcon,
  MessageSquareIcon,
} from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { monthGrid, monthLabel, shiftMonth } from "@/features/tasks/calendar";
import { DueChip, PriorityFlag } from "@/features/tasks/components/task-bits";
import { priorityRank } from "@/features/tasks/constants";
import { formatDay, timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { PORTAL_PROJECT_STATUS, PORTAL_TASK_STATUSES, portalStatus } from "../constants";
import { portalHref, type PortalLink } from "../links";
import type { PortalProject, PortalTask } from "../queries";

export function PortalStatusChip({ status, className }: { status: PortalTask["status"]; className?: string }) {
  const meta = portalStatus(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1", meta.chip, className)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

function Checklist({ subtasks }: { subtasks: PortalTask["subtasks"] }) {
  if (subtasks.total === 0) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground tabular", subtasks.done === subtasks.total && "text-success")}
      title={`${subtasks.done} of ${subtasks.total} steps done`}
    >
      <CheckSquareIcon className="size-3.5" /> {subtasks.done}/{subtasks.total}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Overview
// -----------------------------------------------------------------------------
export function PortalOverview({
  projects,
  tasks,
  today,
  renderedAt,
  link,
  unread,
}: {
  projects: PortalProject[];
  tasks: PortalTask[];
  today: string;
  renderedAt: number;
  link: PortalLink;
  unread: number;
}) {
  const open = tasks.filter((t) => t.status !== "done");
  const inProgress = tasks.filter((t) => t.status === "in_progress" || t.status === "revisions").length;
  const inReview = tasks.filter((t) => t.status === "for_review").length;
  const done = tasks.filter((t) => t.status === "done");
  const upcoming = open
    .filter((t) => t.dueDate)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, 6);
  const finished = [...done].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).slice(0, 5);
  const waitingOnYou = projects.filter((p) => p.status === "client_review");

  return (
    <div className="grid gap-5">
      {waitingOnYou.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/8 p-4">
          <EyeIcon className="size-5 text-warning" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">Ready for your review:</span> {waitingOnYou.map((p) => p.name).join(", ")}
          </p>
          <Button asChild size="sm" variant="secondary">
            <Link href={portalHref(link, "messages")}>Send feedback</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open tasks" value={open.length} icon={ListTodoIcon} />
        <Stat label="Being worked on" value={inProgress} icon={LoaderIcon} />
        <Stat label="In quality check" value={inReview} icon={EyeIcon} />
        <Stat label="Done" value={done.length} icon={CheckCircle2Icon} />
      </div>

      <section className="rounded-xl border bg-card p-5" aria-labelledby="portal-projects">
        <h2 id="portal-projects" className="font-heading text-base font-medium">
          Projects
        </h2>
        {projects.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No projects yet. They show here as soon as work is set up.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {projects.map((project) => {
              const pct = project.total ? Math.round((project.done / project.total) * 100) : 0;
              return (
                <li key={project.id}>
                  <Link
                    href={portalHref(link, "board", { project: project.id })}
                    className="block rounded-lg bg-surface p-4 ring-1 ring-border transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-medium">{project.name}</p>
                      <span className="shrink-0 rounded-full bg-card px-2.5 py-0.5 text-xs font-medium ring-1 ring-border">
                        {PORTAL_PROJECT_STATUS[project.status]}
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-label={`${pct}% of tasks done`}>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                      <span className="tabular">
                        {project.done} of {project.total} {project.total === 1 ? "task" : "tasks"} done
                      </span>
                      <span>
                        {project.status === "delivered" && project.deliveredAt
                          ? `Delivered ${timeAgo(project.deliveredAt, renderedAt)}`
                          : project.deadline
                            ? `Deadline ${formatDay(project.deadline, { month: "short", day: "numeric" })}`
                            : "No deadline set"}
                      </span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5" aria-labelledby="portal-upcoming">
          <h2 id="portal-upcoming" className="font-heading text-base font-medium">
            Coming up
          </h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing with a due date yet.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-2">
              {upcoming.map((task) => (
                <li key={task.id} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5 ring-1 ring-border">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{task.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{task.projectName}</span>
                  </span>
                  <PortalStatusChip status={task.status} className="hidden sm:inline-flex" />
                  <DueChip dueDate={task.dueDate} today={today} done={false} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5" aria-labelledby="portal-finished">
          <div className="flex items-center justify-between gap-3">
            <h2 id="portal-finished" className="font-heading text-base font-medium">
              Recently finished
            </h2>
            <Link href={portalHref(link, "messages")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <MessageSquareIcon className="size-4" />
              Message the team
              {unread > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {unread}
                </span>
              )}
            </Link>
          </div>
          {finished.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Finished work shows here.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-2">
              {finished.map((task) => (
                <li key={task.id} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5 ring-1 ring-border">
                  <CheckCircle2Icon className="size-4 shrink-0 text-success" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{task.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{task.projectName}</span>
                  </span>
                  {task.completedAt && <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(task.completedAt, renderedAt)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="mt-2 font-heading text-2xl font-semibold tracking-tight tabular">{value}</div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Board
// -----------------------------------------------------------------------------
/** Done keeps the most recent few; the list has the rest. */
const DONE_ON_BOARD = 8;

export function PortalBoard({ tasks, today, showProject, link }: { tasks: PortalTask[]; today: string; showProject: boolean; link: PortalLink }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[62rem] grid-cols-5 gap-3">
        {PORTAL_TASK_STATUSES.map((status) => {
          const all = tasks
            .filter((t) => t.status === status.value)
            .sort((a, b) =>
              status.value === "done"
                ? (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
                : (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || priorityRank(b.priority) - priorityRank(a.priority),
            );
          const column = status.value === "done" ? all.slice(0, DONE_ON_BOARD) : all;
          return (
            <section key={status.value} aria-label={status.label} className="flex min-w-0 flex-col">
              <header className="mb-2 flex items-center gap-2 px-1 text-sm">
                <span className={cn("size-2 rounded-full", status.dot)} />
                <span className="font-medium">{status.label}</span>
                <span className="text-muted-foreground tabular">{all.length}</span>
              </header>
              <ul className="grid grid-cols-1 content-start gap-2">
                {column.map((task) => (
                  <li key={task.id} className="rounded-xl border bg-card p-3.5">
                    {showProject && <p className="truncate text-xs text-muted-foreground">{task.projectName}</p>}
                    <p
                      className={cn(
                        "mt-0.5 line-clamp-3 leading-snug font-medium",
                        task.status === "done" && "text-muted-foreground line-through decoration-muted-foreground/40",
                      )}
                    >
                      {task.title}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {task.status !== "done" && task.priority !== "medium" && task.priority !== "low" && <PriorityFlag priority={task.priority} />}
                      <DueChip dueDate={task.dueDate} today={today} done={task.status === "done"} />
                      <Checklist subtasks={task.subtasks} />
                    </div>
                  </li>
                ))}
                {column.length === 0 && (
                  <li className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Nothing here</li>
                )}
                {all.length > column.length && (
                  <li>
                    <Link href={portalHref(link, "list")} className="block rounded-lg p-2 text-center text-xs text-muted-foreground hover:text-foreground">
                      {all.length - column.length} more in the list
                    </Link>
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// List
// -----------------------------------------------------------------------------
type SortKey = "title" | "project" | "status" | "due";
const statusIndex = (status: PortalTask["status"]) => PORTAL_TASK_STATUSES.findIndex((s) => s.value === status);

export function PortalList({ tasks, today, showProject }: { tasks: PortalTask[]; today: string; showProject: boolean }) {
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "due", dir: 1 });

  const sorted = React.useMemo(() => {
    const compare = (a: PortalTask, b: PortalTask) => {
      switch (sort.key) {
        case "title":
          return a.title.localeCompare(b.title);
        case "project":
          return a.projectName.localeCompare(b.projectName);
        case "status":
          return statusIndex(a.status) - statusIndex(b.status);
        case "due":
          if (a.dueDate === b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
      }
    };
    return [...tasks].sort((a, b) => compare(a, b) * sort.dir);
  }, [tasks, sort]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState icon={ListTodoIcon} title="No tasks yet" description="Tasks show here as soon as the team plans the work." />
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
            {showProject && header("project", "Project", "hidden w-52 lg:table-cell")}
            {header("status", "Status", "hidden w-36 md:table-cell")}
            {header("due", "Due", "w-28 sm:w-32")}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((task) => {
            const done = task.status === "done";
            return (
              <tr key={task.id}>
                <td className="px-3 py-2.5">
                  <span className={cn("block truncate font-medium", done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                    {task.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn("truncate", showProject && "lg:hidden")}>{showProject ? task.projectName : null}</span>
                    <Checklist subtasks={task.subtasks} />
                  </span>
                  <span className="mt-1.5 block md:hidden">
                    <PortalStatusChip status={task.status} />
                  </span>
                </td>
                {showProject && <td className="hidden truncate px-3 py-2.5 text-muted-foreground lg:table-cell">{task.projectName}</td>}
                <td className="hidden px-3 py-2.5 md:table-cell">
                  <PortalStatusChip status={task.status} />
                </td>
                <td className="px-3 py-2.5">
                  {task.dueDate ? <DueChip dueDate={task.dueDate} today={today} done={done} /> : <span className="text-xs text-muted-foreground">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Calendar
// -----------------------------------------------------------------------------
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VISIBLE_PER_DAY = 3;

export function PortalCalendar({
  tasks,
  today,
  month,
  link,
}: {
  tasks: PortalTask[];
  today: string;
  month: string;
  link: PortalLink;
}) {
  const grid = monthGrid(month);
  const byDay = new Map<string, PortalTask[]>();
  for (const task of tasks) {
    if (!task.dueDate || task.dueDate < grid.start || task.dueDate > grid.end) continue;
    byDay.set(task.dueDate, [...(byDay.get(task.dueDate) ?? []), task]);
  }
  const monthDays = grid.days.filter((day) => day >= grid.first && day <= grid.last);
  const agendaDays = monthDays.filter((day) => byDay.has(day));

  return (
    <section aria-label={`Calendar, ${monthLabel(month)}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-heading text-lg font-medium">{monthLabel(month)}</h2>
        <Button asChild variant="outline" size="sm">
          <Link href={portalHref(link, "calendar", { month: today.slice(0, 7) })} scroll={false}>
            Today
          </Link>
        </Button>
        <Button asChild variant="outline" size="icon-sm">
          <Link href={portalHref(link, "calendar", { month: shiftMonth(month, -1) })} scroll={false} aria-label="Previous month">
            <ChevronLeftIcon />
          </Link>
        </Button>
        <Button asChild variant="outline" size="icon-sm">
          <Link href={portalHref(link, "calendar", { month: shiftMonth(month, 1) })} scroll={false} aria-label="Next month">
            <ChevronRightIcon />
          </Link>
        </Button>
      </div>

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <div className="grid grid-cols-7 border-b text-xs text-muted-foreground">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-2 font-medium">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
          {grid.days.map((day) => {
            const list = byDay.get(day) ?? [];
            const inMonth = day >= grid.first && day <= grid.last;
            const hidden = list.length - VISIBLE_PER_DAY;
            return (
              <div key={day} className={cn("flex min-h-28 min-w-0 flex-col gap-1 border-r border-b p-1.5", !inMonth && "bg-surface")}>
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-xs tabular",
                    day === today && "bg-primary font-semibold text-primary-foreground",
                    !inMonth && day !== today && "text-muted-foreground/60",
                  )}
                >
                  {Number(day.slice(8))}
                </span>
                {list.slice(0, VISIBLE_PER_DAY).map((task) => (
                  <CalendarChip key={task.id} task={task} today={today} />
                ))}
                {hidden > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="rounded px-1.5 text-left text-xs text-muted-foreground hover:text-foreground">
                        +{hidden} more
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-72 p-2">
                      <p className="px-1.5 pb-1.5 text-xs font-medium text-muted-foreground">
                        {formatDay(day, { weekday: "long", month: "long", day: "numeric" })}
                      </p>
                      <ul className="grid grid-cols-1 gap-1">
                        {list.map((task) => (
                          <li key={task.id} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm">
                            <span className="min-w-0 flex-1 truncate">{task.title}</span>
                            <PortalStatusChip status={task.status} />
                          </li>
                        ))}
                      </ul>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="md:hidden">
        {agendaDays.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EmptyState icon={CalendarDaysIcon} title="Nothing due this month" description="Tasks with a due date show up here." />
          </div>
        ) : (
          <ol className="grid grid-cols-1 gap-4">
            {agendaDays.map((day) => (
              <li key={day}>
                <p className={cn("mb-1.5 px-1 text-sm font-medium", day === today && "text-primary")}>
                  {formatDay(day, { weekday: "long", month: "short", day: "numeric" })}
                  {day === today && " · Today"}
                </p>
                <ul className="grid grid-cols-1 gap-1.5">
                  {byDay.get(day)!.map((task) => (
                    <li key={task.id} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 ring-1 ring-border">
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-medium", task.status === "done" && "text-muted-foreground line-through")}>
                          {task.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{task.projectName}</span>
                      </span>
                      <PortalStatusChip status={task.status} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function CalendarChip({ task, today }: { task: PortalTask; today: string }) {
  const done = task.status === "done";
  const overdue = !done && task.dueDate !== null && task.dueDate < today;
  const meta = portalStatus(task.status);
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-md bg-surface px-1.5 py-1 text-xs ring-1 ring-border",
        overdue && "text-danger ring-danger/30",
        done && "text-muted-foreground",
      )}
      title={`${task.title} · ${meta.label} · ${task.projectName}`}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />
      <span className={cn("truncate", done && "line-through decoration-muted-foreground/40")}>{task.title}</span>
    </span>
  );
}
