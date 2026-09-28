"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, Loader2Icon, MoreHorizontalIcon, PencilIcon, PlayIcon, SendIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TASK_STATUSES, taskStatusMeta, type TaskStatus } from "../../constants";
import type { TaskDraft } from "../task-form-dialog";
import { useTaskWorkspace } from "../task-workspace";

export function TaskHeader({
  task,
  context,
  canWork,
}: {
  task: Required<Omit<TaskDraft, "id">> & { id: string; isTrial: boolean };
  /** Breadcrumb above the title: client and project links. */
  context: React.ReactNode;
  /** The signed-in editor is the assignee (editors only). */
  canWork: boolean;
}) {
  const router = useRouter();
  const workspace = useTaskWorkspace();
  const [pending, startTransition] = React.useTransition();
  const current = taskStatusMeta(task.status);
  const ref = { id: task.id, title: task.title, status: task.status };
  const locked = !workspace.isAdmin && task.status === "done";

  const change = (status: TaskStatus) =>
    startTransition(async () => {
      await workspace.changeStatus(ref, status);
    });

  // The one obvious next step for the editor doing the work.
  const next =
    canWork && !workspace.isAdmin
      ? task.status === "todo"
        ? { status: "in_progress" as const, label: "Start", icon: PlayIcon }
        : task.status === "in_progress" || task.status === "revisions"
          ? { status: "for_review" as const, label: "Send for review", icon: SendIcon }
          : null
      : null;

  return (
    <div className="mb-6">
      <Link
        href={workspace.isAdmin ? "/tasks" : "/my-tasks"}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> {workspace.isAdmin ? "Tasks" : "My Tasks"}
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
                disabled={pending || locked || (!workspace.isAdmin && !canWork)}
                aria-label={`Status: ${current.label}. Change status`}
              >
                <span className={cn("size-2.5 rounded-full", current.dot)} />
                {current.label}
                {!locked && <ChevronDownIcon className="text-muted-foreground" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-2xl">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              {TASK_STATUSES.map((status) => {
                const allowed = workspace.allowedStatuses.includes(status.value);
                return (
                  <DropdownMenuItem
                    key={status.value}
                    disabled={!allowed}
                    onSelect={() => status.value !== task.status && change(status.value)}
                  >
                    <span className={cn("size-2 rounded-full", status.dot)} />
                    {status.label}
                    {status.value === task.status ? (
                      <CheckIcon className="ml-auto" />
                    ) : (
                      !allowed && <span className="ml-auto text-xs text-muted-foreground">Admin</span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          {workspace.isAdmin && (
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
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => workspace.confirmDelete(ref, () => router.push("/tasks"))}>
                  <Trash2Icon /> Delete task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
