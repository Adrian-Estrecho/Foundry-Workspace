"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  SendIcon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClickUpMark } from "@/features/clickup/components/clickup-mark";
import { StatusDot } from "@/features/statuses/components/status-chip";
import type { StatusBadge } from "@/features/statuses/constants";
import type { TaskStatus, TaskStatusDef } from "../../constants";
import type { TaskDraft } from "../task-form-dialog";
import { useTaskWorkspace } from "../task-workspace";

export function TaskHeader({
  task,
  context,
  canWork,
  clickupUrl,
}: {
  task: Required<Omit<TaskDraft, "id">> & { id: string; isTrial: boolean; statusInfo: StatusBadge };
  /** Breadcrumb above the title: client and project links. */
  context: React.ReactNode;
  /** The signed-in editor is the assignee (editors only). */
  canWork: boolean;
  /** Synced from ClickUp: it's deleted there. */
  clickupUrl: string | null;
}) {
  const router = useRouter();
  const workspace = useTaskWorkspace();
  const [pending, startTransition] = React.useTransition();
  const current = task.statusInfo;
  const ref = { id: task.id, title: task.title, status: task.status, statusInfo: task.statusInfo };
  const locked = !workspace.access.anyStatus && task.status === "done";

  const change = (to: TaskStatusDef | TaskStatus) =>
    startTransition(async () => {
      await workspace.changeStatus(ref, to);
    });

  // The one obvious next step for the editor doing the work.
  const next =
    canWork
      ? task.status === "todo"
        ? { status: "in_progress" as const, label: "Start", icon: PlayIcon }
        : task.status === "in_progress" || task.status === "revisions"
          ? { status: "for_review" as const, label: "Send for review", icon: SendIcon }
          : null
      : null;

  return (
    <div className="mb-6">
      <Link
        href={workspace.access.manage && !task.isTrial ? "/tasks" : "/my-tasks"}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> {workspace.access.manage && !task.isTrial ? "Tasks" : "My Tasks"}
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-sm text-muted-foreground">{context}</div>
          <h1 className="mt-0.5 font-heading text-3xl font-semibold tracking-tight break-words">{task.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {next && (
            <Button size="lg" onClick={() => change(next.status)} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <next.icon />}
              {next.label}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="lg"
                className="bg-surface ring-1 ring-border"
                disabled={pending || locked || (!workspace.access.manage && !canWork)}
                aria-label={`Status: ${current.name}. Change status`}
              >
                <StatusDot color={current.color} className="size-2.5" />
                {current.name}
                {!locked && <ChevronDownIcon className="text-muted-foreground" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-96 w-60 overflow-y-auto rounded-2xl">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              {workspace.statuses.map((status) => {
                const allowed = workspace.canMoveTo(status);
                const selected = status.id === current.id;
                return (
                  <DropdownMenuItem key={status.id} disabled={!allowed} onSelect={() => !selected && change(status)}>
                    <StatusDot color={status.color} />
                    <span className="truncate">{status.name}</span>
                    {selected ? (
                      <CheckIcon className="ml-auto" />
                    ) : (
                      !allowed && <span className="ml-auto text-xs text-muted-foreground">Admin</span>
                    )}
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
          {clickupUrl && (
            <Button asChild variant="outline" size="lg">
              <a href={clickupUrl} target="_blank" rel="noreferrer">
                <ClickUpMark /> Open in ClickUp
              </a>
            </Button>
          )}
          {workspace.access.manage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-lg" aria-label="More actions">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                <DropdownMenuItem onSelect={() => workspace.editTask(task)}>
                  <PencilIcon /> Edit task
                </DropdownMenuItem>
                {!clickupUrl && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => workspace.confirmDelete(ref, () => router.push("/tasks"))}>
                      <Trash2Icon /> Delete task
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
