"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { formatDay, relativeDue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { setTaskProgress } from "../../actions";
import type { Person } from "../../queries";
import type { TaskDraft } from "../task-form-dialog";
import { PriorityFlag, TaskStatusChip, dueTone } from "../task-bits";
import { useTaskWorkspace } from "../task-workspace";

export function DetailsPanel({
  task,
  assignee,
  assigneeActive,
  project,
  revisionCount,
  progress,
  canUpdateProgress,
  createdAt,
  creatorName,
  completedAt,
}: {
  task: Required<Omit<TaskDraft, "id">> & { id: string };
  assignee: Person | null;
  assigneeActive: boolean;
  project: { id: string; name: string } | null;
  revisionCount: number;
  progress: number;
  canUpdateProgress: boolean;
  createdAt: string;
  creatorName: string | null;
  completedAt: string | null;
}) {
  const workspace = useTaskWorkspace();
  const done = task.status === "done";

  return (
    <Panel
      title="Details"
      action={
        workspace.isAdmin && (
          <Button size="sm" variant="secondary" className="bg-surface-strong ring-1 ring-border" onClick={() => workspace.editTask(task)}>
            <PencilIcon /> Edit
          </Button>
        )
      }
    >
      <dl className="grid grid-cols-1 gap-4 text-sm">
        <Row label="Assignee">
          {assignee ? (
            <span className="flex min-w-0 items-center gap-2">
              <UserAvatar name={assignee.name} src={assignee.avatarUrl} className="size-6" />
              {workspace.isAdmin ? (
                <Link href={`/editors/${assignee.id}`} className="truncate font-medium hover:text-primary">
                  {assignee.name}
                </Link>
              ) : (
                <span className="truncate font-medium">{assignee.name}</span>
              )}
              {!assigneeActive && <span className="text-xs text-muted-foreground">(inactive)</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          )}
        </Row>
        <Row label="Status">
          <TaskStatusChip status={task.status} />
        </Row>
        <Row label="Due">
          {task.dueDate ? (
            <span className={cn("font-medium", dueTone(task.dueDate, workspace.today, done))}>
              {formatDay(task.dueDate)}
              {!done && <span className="font-normal text-muted-foreground"> · {relativeDue(task.dueDate, workspace.today)}</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">No due date</span>
          )}
        </Row>
        <Row label="Priority">
          <PriorityFlag priority={task.priority} className="text-sm" />
        </Row>
        <Row label="Project">
          {project ? (
            <Link href={`/projects/${project.id}`} className="font-medium hover:text-primary">
              {project.name}
            </Link>
          ) : (
            <span className="text-muted-foreground">Internal</span>
          )}
        </Row>
        <Row label="Revision rounds">
          <span className="font-medium tabular">{revisionCount}</span>
        </Row>
        <Row label="Progress">
          <ProgressControl taskId={task.id} value={done ? 100 : progress} editable={canUpdateProgress && !done} />
        </Row>
        <Row label="Created">
          <span className="text-muted-foreground">
            {formatDay(createdAt.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}
            {creatorName && ` by ${creatorName}`}
          </span>
        </Row>
        {completedAt && (
          <Row label="Completed">
            <span className="text-success">{formatDay(completedAt.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}</span>
          </Row>
        )}
      </dl>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
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
      <span className="flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
        </span>
        <span className="w-9 text-right text-xs tabular">{value}%</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
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
