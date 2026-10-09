import Link from "next/link";
import { CheckSquareIcon, ExternalLinkIcon, GraduationCapIcon, MessageSquareIcon, PaperclipIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ClickUpMark } from "@/features/clickup/components/clickup-mark";
import { cn } from "@/lib/utils";
import type { TaskSummary } from "../queries";
import { DueChip, PriorityFlag, TaskStatusChip } from "./task-bits";

/** "Northwind Fitness · Q4 Reels Package", "Trial task" or "Internal". */
export function taskContext(task: Pick<TaskSummary, "client" | "project" | "isTrial">) {
  if (task.isTrial) return "Trial task";
  return [task.client?.name, task.project?.name].filter(Boolean).join(" · ") || "Internal";
}

/**
 * Board card. The menu (passed in) sits outside the link so there are no
 * nested interactive elements. `show` picks what the footer highlights: the
 * assignee on status boards, the status on the By Editor board.
 */
export function TaskCard({
  task,
  today,
  href,
  menu,
  show = "assignee",
  overlay = false,
}: {
  task: TaskSummary;
  today: string;
  href: string;
  menu?: React.ReactNode;
  show?: "assignee" | "status";
  overlay?: boolean;
}) {
  const done = task.status === "done";
  const overdue = !done && task.dueDate !== null && task.dueDate < today;
  const showProgress = !done && task.progress > 0 && task.status !== "todo";

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card transition-colors hover:border-foreground/20",
        overdue && "border-danger/35",
        overlay && "border-primary/40 bg-popover",
      )}
    >
      <Link href={href} className="block rounded-xl p-3.5 pr-10 outline-none" draggable={false}>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          {task.isTrial && <GraduationCapIcon className="size-3 shrink-0 text-primary" />}
          <span className="truncate">{taskContext(task)}</span>
          {task.clickupUrl && <ClickUpMark className="ml-auto size-3.5" title="From ClickUp" />}
        </p>
        <p className={cn("mt-0.5 line-clamp-2 leading-snug font-medium", done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
          {task.title}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <PriorityFlag priority={task.priority} />
          <DueChip dueDate={task.dueDate} today={today} done={done} />
          {task.revisionCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`${task.revisionCount} revision rounds`}>
              <RotateCcwIcon className="size-3" /> {task.revisionCount}
            </span>
          )}
        </div>

        {showProgress && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-foreground/10" aria-label={`${task.progress}% done`}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${task.progress}%` }} />
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          {task.subtasks.total > 0 && (
            <span className={cn("inline-flex items-center gap-1 tabular", task.subtasks.done === task.subtasks.total && "text-success")}>
              <CheckSquareIcon className="size-3.5" /> {task.subtasks.done}/{task.subtasks.total}
            </span>
          )}
          {task.comments > 0 && (
            <span className="inline-flex items-center gap-1 tabular">
              <MessageSquareIcon className="size-3.5" /> {task.comments}
            </span>
          )}
          {task.attachments > 0 && (
            <span className="inline-flex items-center gap-1 tabular">
              <PaperclipIcon className="size-3.5" /> {task.attachments}
            </span>
          )}
          <span className="ml-auto">
            {show === "status" ? (
              <TaskStatusChip status={task.statusInfo} />
            ) : task.assignee ? (
              <UserAvatar name={task.assignee.name} src={task.assignee.avatarUrl} className="size-6" />
            ) : (
              <span className="text-xs">Unassigned</span>
            )}
          </span>
        </div>
      </Link>
      {task.editedVideo && <EditedVideoLink video={task.editedVideo} />}
      {menu && <div className="absolute top-2 right-2">{menu}</div>}
    </div>
  );
}

/** The newest edited video, one click from the board. Outside the card's link, so the two don't nest. */
export function EditedVideoLink({ video, className }: { video: NonNullable<TaskSummary["editedVideo"]>; className?: string }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      onPointerDown={(event) => event.stopPropagation()}
      className={cn(
        "flex items-center gap-2 rounded-b-xl border-t px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-primary/8 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      title={`Open the edited video (version ${video.version})`}
    >
      <span className="grid size-5 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
        <PlayIcon className="size-3 fill-current" />
      </span>
      Edited video
      <span className="rounded-md bg-primary/12 px-1.5 py-px text-[11px] font-semibold text-primary tabular">v{video.version}</span>
      <ExternalLinkIcon className="ml-auto size-3.5" />
    </a>
  );
}
