"use client";

import Link from "next/link";
import { ArrowRightIcon, ExternalLinkIcon, MoreHorizontalIcon, PlusIcon, Trash2Icon, UserRoundIcon } from "lucide-react";
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
import { StatusDot } from "@/features/statuses/components/status-chip";
import { cn } from "@/lib/utils";
import type { TaskSummary } from "../queries";
import { useTaskWorkspace } from "./task-workspace";

/** Where a task opens. Editors hand in trial tasks from their onboarding page. */
export const taskHref = (task: Pick<TaskSummary, "id" | "isTrial">, isAdmin: boolean) =>
  task.isTrial && !isAdmin ? "/onboarding" : `/tasks/${task.id}`;

/** Card and row actions. "Move to" also works on phones, where dragging is fiddly. */
export function TaskMenu({ task, className }: { task: TaskSummary; className?: string }) {
  const workspace = useTaskWorkspace();
  const targets = workspace.statuses.filter((s) => s.id !== task.statusInfo.id && workspace.canMoveTo(s));
  const editors = workspace.options?.editors.filter((e) => e.isActive && e.id !== task.assignee?.id) ?? [];
  const canMove = targets.length > 0 && (workspace.isAdmin || task.status !== "done");

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
          <Link href={taskHref(task, workspace.isAdmin)}>
            <ExternalLinkIcon /> Open task
          </Link>
        </DropdownMenuItem>
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
              {workspace.isAdmin && (
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
        {workspace.isAdmin && (
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
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => workspace.confirmDelete(task)}>
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
