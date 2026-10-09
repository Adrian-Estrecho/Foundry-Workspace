"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  CircleDotIcon,
  Clock3Icon,
  FlagIcon,
  FolderIcon,
  GaugeIcon,
  Loader2Icon,
  RotateCcwIcon,
  Settings2Icon,
  SparklesIcon,
  UserRoundIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClickUpMark } from "@/features/clickup/components/clickup-mark";
import { StatusDot } from "@/features/statuses/components/status-chip";
import type { StatusBadge } from "@/features/statuses/constants";
import { formatDay, formatDuration, relativeDue } from "@/lib/dates";
import { PRIORITY_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import { rescheduleTask, setTaskPriority, setTaskProgress } from "../../actions";
import { TASK_PRIORITIES, type TaskPriority, type TaskStatus, type TaskStatusDef } from "../../constants";
import type { Person } from "../../queries";
import { PriorityFlag, TaskStatusChip, dueTone } from "../task-bits";
import { useTaskWorkspace } from "../task-workspace";

type TaskFacts = {
  id: string;
  title: string;
  status: TaskStatus;
  statusInfo: StatusBadge;
  dueDate: string | null;
  priority: TaskPriority;
  fromClickUp: boolean;
};

/**
 * The task's fields in two columns, as ClickUp lays them out. People who
 * manage tasks change status, assignee, due date and priority in place;
 * editors move their own task's status and progress.
 */
export function TaskProperties({
  task,
  canWork,
  assignee,
  assigneeActive,
  project,
  revisionCount,
  progress,
  canUpdateProgress,
  time,
  createdAt,
  creatorName,
  completedAt,
}: {
  task: TaskFacts;
  /** The signed-in editor is the assignee. */
  canWork: boolean;
  assignee: Person | null;
  assigneeActive: boolean;
  project: { id: string; name: string } | null;
  revisionCount: number;
  progress: number;
  canUpdateProgress: boolean;
  /** Logged time per editor, most first. */
  time: { editorId: string; name: string; seconds: number }[];
  createdAt: string;
  creatorName: string | null;
  completedAt: string | null;
}) {
  const workspace = useTaskWorkspace();
  const done = task.status === "done";
  const manage = workspace.access.manage;
  const totalSeconds = time.reduce((sum, row) => sum + row.seconds, 0);

  return (
    <div className="border-b pb-5">
      <dl className="grid grid-cols-1 gap-x-10 gap-y-1 md:grid-cols-2">
        <Property icon={CircleDotIcon} label="Status">
          <StatusControl task={task} canWork={canWork} />
        </Property>
        <Property icon={UserRoundIcon} label="Assignee">
          <AssigneeControl task={task} assignee={assignee} assigneeActive={assigneeActive} />
        </Property>
        <Property icon={CalendarIcon} label="Due date">
          {manage ? (
            <DueControl task={task} />
          ) : (
            <DueText dueDate={task.dueDate} done={done} today={workspace.today} />
          )}
        </Property>
        <Property icon={FlagIcon} label="Priority">
          {manage ? <PriorityControl task={task} /> : <PriorityFlag priority={task.priority} className="text-sm" />}
        </Property>
        <Property icon={FolderIcon} label="Project">
          {project ? (
            <Link href={`/projects/${project.id}`} className="truncate text-sm font-medium hover:text-primary">
              {project.name}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Internal</span>
          )}
        </Property>
        <Property icon={GaugeIcon} label="Progress">
          <ProgressControl taskId={task.id} value={done ? 100 : progress} editable={canUpdateProgress && !done} />
        </Property>
        <Property icon={RotateCcwIcon} label="Revisions">
          <span className="text-sm font-medium tabular">
            {revisionCount === 0 ? <span className="font-normal text-muted-foreground">None</span> : `${revisionCount} ${revisionCount === 1 ? "round" : "rounds"}`}
          </span>
        </Property>
        <Property icon={Clock3Icon} label="Time logged">
          {totalSeconds === 0 ? (
            <span className="text-sm text-muted-foreground">Nothing yet</span>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={propertyButton}>
                  <span className="font-medium tabular">{formatDuration(totalSeconds)}</span>
                  <span className="text-muted-foreground">
                    · {time.length} {time.length === 1 ? "editor" : "editors"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64">
                <ul className="grid gap-2 text-sm">
                  {time.map((row) => (
                    <li key={row.editorId} className="flex items-center justify-between gap-3">
                      <span className="truncate">{row.name}</span>
                      <span className="font-medium tabular">{formatDuration(row.seconds)}</span>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )}
        </Property>
        <Property icon={SparklesIcon} label="Created">
          <span className="truncate text-sm text-muted-foreground">
            {formatDay(createdAt.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}
            {creatorName && ` by ${creatorName}`}
          </span>
        </Property>
        {completedAt && (
          <Property icon={CheckCircle2Icon} label="Completed">
            <span className="text-sm text-success">{formatDay(completedAt.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}</span>
          </Property>
        )}
      </dl>
      {task.fromClickUp && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClickUpMark className="size-3.5" />
          Synced with ClickUp: changes, comments, links and files made here are sent there, and changes made there show up here.
        </p>
      )}
    </div>
  );
}

const propertyButton =
  "-mx-2 inline-flex h-8 max-w-full min-w-0 items-center gap-2 rounded-md px-2 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent disabled:pointer-events-none";

function Property({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-10 grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-2">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="flex min-w-0 items-center">{children}</dd>
    </div>
  );
}

function StatusControl({ task, canWork }: { task: TaskFacts; canWork: boolean }) {
  const workspace = useTaskWorkspace();
  const [pending, startTransition] = React.useTransition();
  const locked = !workspace.access.anyStatus && task.status === "done";
  const ref = { id: task.id, title: task.title, status: task.status, statusInfo: task.statusInfo };
  const change = (to: TaskStatusDef) =>
    startTransition(async () => {
      await workspace.changeStatus(ref, to);
    });

  if (locked || (!workspace.access.manage && !canWork)) return <TaskStatusChip status={task.statusInfo} />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={propertyButton} disabled={pending} aria-label={`Status: ${task.statusInfo.name}. Change status`}>
          <TaskStatusChip status={task.statusInfo} />
          {pending ? <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" /> : <ChevronDownIcon className="size-3.5 text-muted-foreground" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-60 overflow-y-auto rounded-2xl">
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        {workspace.statuses.map((status) => {
          const allowed = workspace.canMoveTo(status);
          const selected = status.id === task.statusInfo.id;
          return (
            <DropdownMenuItem key={status.id} disabled={!allowed} onSelect={() => !selected && change(status)}>
              <StatusDot color={status.color} />
              <span className="truncate">{status.name}</span>
              {selected ? <CheckIcon className="ml-auto" /> : !allowed && <span className="ml-auto text-xs text-muted-foreground">Admin</span>}
            </DropdownMenuItem>
          );
        })}
        {workspace.access.statuses && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => workspace.manageStatuses()}>
              <Settings2Icon /> Edit statuses
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssigneeControl({ task, assignee, assigneeActive }: { task: TaskFacts; assignee: Person | null; assigneeActive: boolean }) {
  const workspace = useTaskWorkspace();
  const [pending, startTransition] = React.useTransition();
  const editors = workspace.options?.editors.filter((e) => e.isActive) ?? [];

  const who = assignee ? (
    <>
      <UserAvatar name={assignee.name} src={assignee.avatarUrl} className="size-6" />
      <span className="truncate font-medium">{assignee.name}</span>
      {!assigneeActive && <span className="text-xs text-muted-foreground">(inactive)</span>}
    </>
  ) : (
    <span className="text-muted-foreground">Unassigned</span>
  );

  if (!workspace.access.manage) {
    return assignee && workspace.access.editors ? (
      <Link href={`/editors/${assignee.id}`} className={propertyButton}>
        {who}
      </Link>
    ) : (
      <span className="flex min-w-0 items-center gap-2 text-sm">{who}</span>
    );
  }

  const assign = (editorId: string | null, name: string) =>
    startTransition(async () => {
      await workspace.assign(task, editorId, name);
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={propertyButton} disabled={pending}>
          {who}
          {pending ? <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" /> : <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto rounded-2xl">
        <DropdownMenuLabel>Assign to</DropdownMenuLabel>
        {editors.map((editor) => (
          <DropdownMenuItem key={editor.id} onSelect={() => editor.id !== assignee?.id && assign(editor.id, editor.name)}>
            <UserAvatar name={editor.name} src={editor.avatarUrl} className="size-5" />
            <span className="truncate">{editor.name}</span>
            {editor.id === assignee?.id && <CheckIcon className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        {assignee && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => assign(null, "")}>Unassigned</DropdownMenuItem>
            {workspace.access.editors && (
              <DropdownMenuItem asChild>
                <Link href={`/editors/${assignee.id}`}>Open {assignee.name.split(" ")[0]}&apos;s profile</Link>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DueText({ dueDate, done, today }: { dueDate: string | null; done: boolean; today: string }) {
  if (!dueDate) return <span className="text-sm text-muted-foreground">No due date</span>;
  return (
    <span className={cn("truncate text-sm font-medium", dueTone(dueDate, today, done))}>
      {formatDay(dueDate)}
      {!done && <span className="font-normal text-muted-foreground"> · {relativeDue(dueDate, today)}</span>}
    </span>
  );
}

function DueControl({ task }: { task: TaskFacts }) {
  const workspace = useTaskWorkspace();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(task.dueDate ?? "");
  const [pending, startTransition] = React.useTransition();

  const save = (date: string | null) =>
    startTransition(async () => {
      const result = await rescheduleTask(task.id, date);
      if (!result.ok) return void toast.error(result.error);
      toast.success(date ? `Due ${formatDay(date, { month: "short", day: "numeric" })}` : "Due date cleared");
      setOpen(false);
      router.refresh();
    });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(task.dueDate ?? "");
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={propertyButton}>
          <DueText dueDate={task.dueDate} done={task.status === "done"} today={workspace.today} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (value) save(value);
          }}
        >
          <Input type="date" value={value} onChange={(event) => setValue(event.target.value)} aria-label="Due date" autoFocus className="h-9" />
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={pending || !task.dueDate} onClick={() => save(null)}>
              Clear
            </Button>
            <Button type="submit" size="sm" disabled={pending || !value || value === task.dueDate}>
              {pending && <Loader2Icon className="animate-spin" />} Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function PriorityControl({ task }: { task: TaskFacts }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [shown, setShown] = React.useOptimistic(task.priority);

  const change = (priority: TaskPriority) =>
    startTransition(async () => {
      setShown(priority);
      const result = await setTaskPriority(task.id, priority);
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={propertyButton} disabled={pending} aria-label={`Priority: ${PRIORITY_META[shown].label}. Change priority`}>
          <PriorityFlag priority={shown} className="text-sm" />
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44 rounded-2xl">
        <DropdownMenuLabel>Priority</DropdownMenuLabel>
        {TASK_PRIORITIES.map((priority) => (
          <DropdownMenuItem key={priority.value} onSelect={() => priority.value !== shown && change(priority.value)}>
            <FlagIcon className={PRIORITY_META[priority.value].className} />
            {priority.label}
            {priority.value === shown && <CheckIcon className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Slider in 5% steps; saves when you let go. */
function ProgressControl({ taskId, value, editable }: { taskId: string; value: number; editable: boolean }) {
  const [draft, setDraft] = React.useState(value);
  const [synced, setSynced] = React.useState(value);
  const [, startTransition] = React.useTransition();
  // Pointer-up, key-up and blur can all fire for one change: save it once.
  const [saved, setSaved] = React.useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
    setSaved(value);
  }

  const save = () => {
    if (draft === saved) return;
    setSaved(draft);
    startTransition(async () => {
      const result = await setTaskProgress(taskId, draft);
      if (!result.ok) {
        toast.error(result.error);
        setDraft(value);
        setSaved(value);
      }
    });
  };

  if (!editable) {
    return (
      <span className="flex w-full max-w-56 items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
        </span>
        <span className="w-9 text-right text-xs tabular">{value}%</span>
      </span>
    );
  }

  return (
    <span className="flex w-full max-w-56 items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={draft}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={save}
        onKeyUp={save}
        onBlur={save}
        aria-label="Progress"
        aria-valuetext={`${draft}%`}
        className="h-1.5 flex-1 cursor-pointer accent-primary"
      />
      <span className="w-9 text-right text-xs tabular">{draft}%</span>
    </span>
  );
}
