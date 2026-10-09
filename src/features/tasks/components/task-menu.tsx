"use client";

import Link from "next/link";
import { ArrowRightIcon, ExternalLinkIcon, MoreHorizontalIcon, PlayIcon, PlusIcon, Trash2Icon, UserRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClickUpMark } from "@/features/clickup/components/clickup-mark";
import { StatusDot } from "@/features/statuses/components/status-chip";
import { cn } from "@/lib/utils";
import type { TaskSummary } from "../queries";
import { useTaskWorkspace } from "./task-workspace";

/** Where a task opens. Editors hand in trial tasks from their onboarding page. */
export const taskHref = (task: Pick<TaskSummary, "id" | "isTrial">, manage: boolean) =>
  task.isTrial && !manage ? "/onboarding" : `/tasks/${task.id}`;

/** Card and row actions. "Move to" also works on phones, where dragging is fiddly. */
export function TaskMenu({ task, className }: { task: TaskSummary; className?: string }) {
  const workspace = useTaskWorkspace();
  const targets = workspace.statuses.filter((s) => s.id !== task.statusInfo.id && workspace.canMoveTo(s));
  const editors = workspace.options?.editors.filter((e) => e.isActive && e.id !== task.assignee?.id) ?? [];
  const canMove = targets.length > 0 && (workspace.access.anyStatus || task.status !== "done");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("rounded-full opacity-60 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100", className)}
          aria-label={`Actions for ${task.title}`}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-2xl">
        <DropdownMenuItem asChild>
          <Link href={taskHref(task, workspace.access.manage)}>
            <ExternalLinkIcon /> Open task
          </Link>
        </DropdownMenuItem>
        {task.editedVideo && (
          <DropdownMenuItem asChild>
            <a href={task.editedVideo.url} target="_blank" rel="noreferrer">
              <PlayIcon /> Edited video
              <span className="ml-auto text-xs font-semibold text-primary tabular">v{task.editedVideo.version}</span>
            </a>
          </DropdownMenuItem>
        )}
        {task.clickupUrl && (
          <DropdownMenuItem asChild>
            <a href={task.clickupUrl} target="_blank" rel="noreferrer">
              <ClickUpMark /> Open in ClickUp
            </a>
          </DropdownMenuItem>
        )}
        {canMove && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightIcon /> Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 overflow-y-auto rounded-2xl">
              {targets.map((status) => (
                <DropdownMenuItem key={status.id} onSelect={() => void workspace.changeStatus(task, status)}>
                  <StatusDot color={status.color} /> {status.name}
                </DropdownMenuItem>
              ))}
              {workspace.access.statuses && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => workspace.addStatus()}>
                    <PlusIcon /> New status
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {workspace.access.manage && (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <UserRoundIcon /> Assign to
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 overflow-y-auto rounded-2xl">
                {editors.map((editor) => (
                  <DropdownMenuItem key={editor.id} onSelect={() => void workspace.assign(task, editor.id, editor.name)}>
                    {editor.name}
                  </DropdownMenuItem>
                ))}
                {task.assignee && (
                  <>
                    {editors.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem onSelect={() => void workspace.assign(task, null, "")}>Unassigned</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {/* Synced tasks are deleted or archived in ClickUp. */}
            {!task.clickupUrl && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => workspace.confirmDelete(task)}>
                  <Trash2Icon /> Delete
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
