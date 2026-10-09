"use client";

import Link from "next/link";
import { CheckSquareIcon, ChevronDownIcon, ListVideoIcon, PlayIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StatusChip, StatusDot } from "@/features/statuses/components/status-chip";
import { DueChip, PriorityFlag } from "@/features/tasks/components/task-bits";
import { priorityRank, type TaskStatusDef } from "@/features/tasks/constants";
import { cn } from "@/lib/utils";
import { inPortalList, PORTAL_LISTS, type PortalListView } from "../constants";
import { portalHref, type PortalLink } from "../links";
import type { PortalTask } from "../queries";

/** The status a task sits in. One whose status can't be read goes to the first status of its stage. */
const columnOf = (task: PortalTask, statuses: TaskStatusDef[]) =>
  statuses.find((s) => s.id === task.statusInfo.id)?.id ?? statuses.find((s) => s.stage === task.status)?.id;

/** Soonest due first (no date last), then the most urgent. Finished work: the latest first. */
const inOrder = (finished: boolean) => (a: PortalTask, b: PortalTask) =>
  finished
    ? (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
    : (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || priorityRank(b.priority) - priorityRank(a.priority);

function Checklist({ subtasks, className }: { subtasks: PortalTask["subtasks"]; className?: string }) {
  if (subtasks.total === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular",
        subtasks.done === subtasks.total && "text-success",
        className,
      )}
      title={`${subtasks.done} of ${subtasks.total} steps done`}
    >
      <CheckSquareIcon className="size-3" /> {subtasks.done}/{subtasks.total}
    </span>
  );
}

/** The newest edited video, one click away. It opens wherever the team shared it (Frame.io, Drive…). */
function WatchVideo({ task, variant, className }: { task: PortalTask; variant: "card" | "row"; className?: string }) {
  const video = task.editedVideo;
  if (!video) return null;
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Watch ${task.title}, version ${video.version} (opens in a new tab)`}
      title={`Watch the edited video (version ${video.version})`}
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "card"
          ? "border-t px-2.5 py-1.5 hover:bg-primary/8 focus-visible:ring-inset"
          : "w-fit rounded-md bg-primary/10 px-2 py-1 hover:bg-primary/15",
        className,
      )}
    >
      <PlayIcon className="size-3 shrink-0 fill-current" />
      {variant === "card" ? "Watch video" : "Watch"}
      <span className={cn("text-[10px] font-semibold tabular", variant === "card" ? "ml-auto rounded bg-primary/12 px-1.5" : "opacity-75")}>
        v{video.version}
      </span>
    </a>
  );
}

// -----------------------------------------------------------------------------
// Lists
// -----------------------------------------------------------------------------
const EMPTY: Record<PortalListView, { title: string; description: string }> = {
  videos: { title: "No videos yet", description: "Videos show here as soon as the team starts on them." },
  "ready-to-post": { title: "Nothing ready to post", description: "Finished videos show here when they're ready for you to post." },
  posted: { title: "Nothing posted yet", description: "Videos show here once they're posted." },
  archived: { title: "Nothing archived", description: "Archived videos show here." },
};

/**
 * One of the portal's lists, grouped by status like the team's ClickUp lists:
 * the furthest along first, each group with its own headings and folding away.
 */
export function PortalList({
  list,
  tasks,
  statuses,
  today,
  showProject,
}: {
  list: PortalListView;
  tasks: PortalTask[];
  statuses: TaskStatusDef[];
  today: string;
  showProject: boolean;
}) {
  const groups = [...statuses]
    .reverse()
    .map((status) => ({
      status,
      tasks: tasks.filter((t) => columnOf(t, statuses) === status.id).sort(inOrder(status.stage === "done")),
    }))
    .filter((group) => group.tasks.length > 0);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState icon={ListVideoIcon} title={EMPTY[list].title} description={EMPTY[list].description} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      {groups.map(({ status, tasks: inGroup }) => (
        <Collapsible key={status.id} defaultOpen asChild>
          <section aria-label={status.name}>
            <div className="mb-2 flex items-center gap-2">
              <CollapsibleTrigger className="group inline-flex items-center gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                <StatusChip status={status} className="rounded-md px-2 text-[11px] font-semibold tracking-wide uppercase" />
              </CollapsibleTrigger>
              <span className="text-sm text-muted-foreground tabular">{inGroup.length}</span>
            </div>
            <CollapsibleContent>
              <div className="overflow-hidden rounded-xl border bg-card">
                <table className="w-full table-fixed text-sm">
                  <thead className="border-b text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Name
                      </th>
                      {showProject && (
                        <th scope="col" className="hidden w-48 px-3 py-2 font-medium lg:table-cell">
                          Project
                        </th>
                      )}
                      <th scope="col" className="hidden w-28 px-3 py-2 font-medium sm:table-cell">
                        Video
                      </th>
                      <th scope="col" className="w-28 px-3 py-2 font-medium">
                        Due date
                      </th>
                      <th scope="col" className="hidden w-24 px-3 py-2 font-medium md:table-cell">
                        Priority
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inGroup.map((task) => (
                      <tr key={task.id}>
                        <td className="px-3 py-2.5">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <StatusDot color={status.color} />
                            <span className="truncate font-medium">{task.title}</span>
                            <Checklist subtasks={task.subtasks} />
                          </span>
                          {showProject && <span className="mt-0.5 block truncate pl-4.5 text-xs text-muted-foreground lg:hidden">{task.projectName}</span>}
                          <WatchVideo task={task} variant="row" className="mt-1.5 ml-4.5 sm:hidden" />
                        </td>
                        {showProject && <td className="hidden truncate px-3 py-2.5 text-muted-foreground lg:table-cell">{task.projectName}</td>}
                        <td className="hidden px-3 py-2.5 sm:table-cell">
                          {task.editedVideo ? <WatchVideo task={task} variant="row" /> : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {task.dueDate ? (
                            <DueChip dueDate={task.dueDate} today={today} done={task.status === "done"} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="hidden px-3 py-2.5 md:table-cell">
                          <PriorityFlag priority={task.priority} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </section>
        </Collapsible>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Board
// -----------------------------------------------------------------------------
/** Done columns keep the most recent few; the lists have the rest. */
const DONE_ON_BOARD = 8;

/** A column per workspace status, in the order the team arranged them on their own board. */
export function PortalBoard({
  tasks,
  statuses,
  today,
  showProject,
  link,
}: {
  tasks: PortalTask[];
  statuses: TaskStatusDef[];
  today: string;
  showProject: boolean;
  link: PortalLink;
}) {
  return (
    <div
      role="region"
      aria-label="Video board"
      className="-mx-4 flex snap-x snap-mandatory scroll-px-4 items-start gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0 lg:snap-none"
    >
      {statuses.map((status) => {
        const finished = status.stage === "done";
        const all = tasks.filter((t) => columnOf(t, statuses) === status.id).sort(inOrder(finished));
        const column = finished ? all.slice(0, DONE_ON_BOARD) : all;
        // "More" goes to the list this status belongs to (Posted…), or to every video.
        const home = PORTAL_LISTS.find((list) => list.statuses && inPortalList(list, status.name)) ?? PORTAL_LISTS[0];
        return (
          <section
            key={status.id}
            aria-label={status.name}
            className="flex w-[70vw] max-w-64 shrink-0 snap-start flex-col sm:w-auto sm:max-w-none sm:min-w-44 sm:flex-1 sm:basis-0"
          >
            <header className="mb-2 flex items-center gap-2 px-1 text-[13px]">
              <StatusDot color={status.color} />
              <span className="truncate font-medium">{status.name}</span>
              <span className="text-muted-foreground tabular">{all.length}</span>
            </header>
            <ul className="grid grid-cols-1 content-start gap-1.5">
              {column.map((task) => (
                <BoardCard key={task.id} task={task} today={today} showProject={showProject} />
              ))}
              {column.length === 0 && <li className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">Nothing here</li>}
              {all.length > column.length && (
                <li>
                  <Link href={portalHref(link, home.value)} className="block rounded-lg p-1.5 text-center text-xs text-muted-foreground hover:text-foreground">
                    {all.length - column.length} more in {home.label}
                  </Link>
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** A small card: the title, what's due, and the edited video to watch when there is one. */
function BoardCard({ task, today, showProject }: { task: PortalTask; today: string; showProject: boolean }) {
  const done = task.status === "done";
  const flagged = !done && (task.priority === "high" || task.priority === "urgent");
  const details = flagged || task.dueDate !== null || task.subtasks.total > 0;
  return (
    <li className="overflow-hidden rounded-lg border bg-card">
      <div className="px-2.5 py-2">
        {showProject && <p className="truncate text-[11px] text-muted-foreground">{task.projectName}</p>}
        <p className="line-clamp-2 text-[13px] leading-snug font-medium">{task.title}</p>
        {details && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {flagged && <PriorityFlag priority={task.priority} className="text-[11px]" />}
            <DueChip dueDate={task.dueDate} today={today} done={done} className="text-[11px]" />
            <Checklist subtasks={task.subtasks} className="text-[11px]" />
          </div>
        )}
      </div>
      <WatchVideo task={task} variant="card" />
    </li>
  );
}
