"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, Loader2Icon, MoreHorizontalIcon, PencilIcon, PlayIcon, SendIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClickUpMark } from "@/features/clickup/components/clickup-mark";
import type { StatusBadge } from "@/features/statuses/constants";
import type { TaskStatus } from "../../constants";
import type { TaskDraft } from "../task-form-dialog";
import { useTaskWorkspace } from "../task-workspace";
import { CommentsToggle } from "./task-detail-shell";

export function TaskHeader({
  task,
  context,
  canWork,
  clickupUrl,
  commentCount,
}: {
  task: Required<Omit<TaskDraft, "id">> & { id: string; isTrial: boolean; statusInfo: StatusBadge };
  /** Breadcrumb above the title: client and project links. */
  context: React.ReactNode;
  /** The signed-in editor is the assignee (editors only). */
  canWork: boolean;
  /** Synced from ClickUp: it's deleted there. */
  clickupUrl: string | null;
  commentCount: number;
}) {
  const router = useRouter();
  const workspace = useTaskWorkspace();
  const [pending, startTransition] = React.useTransition();
  const ref = { id: task.id, title: task.title, status: task.status, statusInfo: task.statusInfo };
  const back = workspace.access.manage && !task.isTrial ? { href: "/tasks", label: "Tasks" } : { href: "/my-tasks", label: "My Tasks" };

  const change = (to: TaskStatus) =>
    startTransition(async () => {
      await workspace.changeStatus(ref, to);
    });

  // The one obvious next step for the editor doing the work.
  const next = canWork
    ? task.status === "todo"
      ? { status: "in_progress" as const, label: "Start", icon: PlayIcon }
      : task.status === "in_progress" || task.status === "revisions"
        ? { status: "for_review" as const, label: "Send for review", icon: SendIcon }
        : null
    : null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-3">
        <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> {back.label}
        </Link>
        <div className="flex items-center gap-1.5">
          {clickupUrl && (
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <a href={clickupUrl} target="_blank" rel="noreferrer">
                <ClickUpMark /> <span className="hidden sm:inline">Open in ClickUp</span>
              </a>
            </Button>
          )}
          {workspace.access.manage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions" className="text-muted-foreground">
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
          <CommentsToggle count={commentCount} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <span className="truncate">{context}</span>
            {clickupUrl && <ClickUpMark className="size-3.5" title="Synced with ClickUp" />}
          </div>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight break-words sm:text-3xl">{task.title}</h1>
        </div>
        {next ? (
          <Button size="lg" onClick={() => change(next.status)} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <next.icon />}
            {next.label}
          </Button>
        ) : (
          workspace.access.manage && (
            <Button variant="outline" onClick={() => workspace.editTask(task)}>
              <PencilIcon /> Edit
            </Button>
          )
        )}
      </div>
    </div>
  );
}
