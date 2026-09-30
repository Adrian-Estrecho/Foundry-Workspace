"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusDialog } from "@/features/statuses/components/status-dialog";
import { deleteTask, moveTask, reassignTask } from "../actions";
import { EDITOR_STAGES, TASK_STAGES, type TaskStatus, type TaskStatusDef } from "../constants";
import type { TaskFormOptions } from "../queries";
import { TaskFormDialog, type TaskDraft } from "./task-form-dialog";

/** A task as status changes need it: its stage and its status. */
type TaskRef = { id: string; title: string; status: TaskStatus; statusInfo: { id: string } };

type Workspace = {
  isAdmin: boolean;
  today: string;
  options: TaskFormOptions | null;
  /** The workspace's task statuses, in board order. */
  statuses: TaskStatusDef[];
  /** Whether this person may move a task to the status. */
  canMoveTo: (status: TaskStatusDef) => boolean;
  newTask: (draft?: TaskDraft) => void;
  editTask: (task: TaskDraft & { id: string }) => void;
  confirmDelete: (task: Pick<TaskRef, "id" | "title">, then?: () => void) => void;
  /**
   * Status change from a menu or button (asks for feedback before Revisions).
   * A stage means that stage's first status.
   */
  changeStatus: (task: TaskRef, to: TaskStatusDef | TaskStatus) => Promise<boolean>;
  /** Board drop: persists the move, asking for feedback first when dropped on Revisions. */
  dropOnStatus: (task: TaskRef, to: TaskStatusDef, position: number) => Promise<boolean>;
  assign: (task: Pick<TaskRef, "id" | "title">, editorId: string | null, editorName: string) => Promise<boolean>;
  /** Admins: opens the new-status dialog. */
  addStatus: (stage?: TaskStatus) => void;
};

const WorkspaceContext = React.createContext<Workspace | null>(null);

export function useTaskWorkspace() {
  const workspace = React.useContext(WorkspaceContext);
  if (!workspace) throw new Error("useTaskWorkspace must be used inside <TaskWorkspace>.");
  return workspace;
}

type Feedback = { task: TaskRef; target: TaskStatusDef; position: number | null; resolve: (ok: boolean) => void };

/**
 * Shared task behaviour for every view: the new/edit dialog, delete
 * confirmation, and status changes with the rules applied up front (editors
 * stop at the For Review stage; entering Revisions asks the admin what to
 * change). Admins can add a status from here too.
 */
export function TaskWorkspace({
  isAdmin,
  today,
  options,
  statuses,
  children,
}: {
  isAdmin: boolean;
  today: string;
  options: TaskFormOptions | null;
  statuses: TaskStatusDef[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<{ key: number; draft: TaskDraft } | null>(null);
  const [toDelete, setToDelete] = React.useState<{ task: Pick<TaskRef, "id" | "title">; then?: () => void } | null>(null);
  const [deleting, startDelete] = React.useTransition();
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [newStatus, setNewStatus] = React.useState<{ key: number; stage: TaskStatus } | null>(null);

  const canMoveTo = (status: TaskStatusDef) => isAdmin || EDITOR_STAGES.includes(status.stage);

  const guard = (task: TaskRef, target: TaskStatusDef) => {
    if (isAdmin) return true;
    if (task.status === "done") {
      toast.error("This task is done. Ask an admin to reopen it.");
      return false;
    }
    if (!canMoveTo(target)) {
      toast.error(`Only an admin can move a task to ${target.name}.`);
      return false;
    }
    return true;
  };

  const announce = (task: TaskRef, target: TaskStatusDef) =>
    toast.success(`${task.title} moved to ${target.name}`, {
      description:
        target.stage === "for_review" && task.status !== "for_review" && !isAdmin ? "Your admins have been notified." : undefined,
    });

  const askFeedback = (task: TaskRef, target: TaskStatusDef, position: number | null) =>
    new Promise<boolean>((resolve) => setFeedback({ task, target, position, resolve }));

  const workspace: Workspace = {
    isAdmin,
    today,
    options,
    statuses,
    canMoveTo,
    newTask: (draft = {}) => setForm((f) => ({ key: (f?.key ?? 0) + 1, draft })),
    editTask: (task) => setForm((f) => ({ key: (f?.key ?? 0) + 1, draft: task })),
    confirmDelete: (task, then) => setToDelete({ task, then }),
    changeStatus: async (task, to) => {
      const target = typeof to === "string" ? statuses.find((s) => s.stage === to) : to;
      if (!target || target.id === task.statusInfo.id || !guard(task, target)) return false;
      if (target.stage === "revisions" && task.status !== "revisions") return askFeedback(task, target, null);
      const result = await moveTask(task.id, target.id, null);
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      announce(task, target);
      router.refresh();
      return true;
    },
    dropOnStatus: async (task, target, position) => {
      const moving = target.id !== task.statusInfo.id;
      if (moving && !guard(task, target)) return false;
      if (target.stage === "revisions" && task.status !== "revisions") return askFeedback(task, target, position);
      const result = await moveTask(task.id, target.id, position);
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      if (moving) announce(task, target);
      return true;
    },
    assign: async (task, editorId, editorName) => {
      const result = await reassignTask(task.id, editorId);
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      toast.success(editorId ? `${task.title} assigned to ${editorName}` : `${task.title} is now unassigned`, {
        description: editorId ? "They've been notified." : undefined,
      });
      router.refresh();
      return true;
    },
    addStatus: (stage = "in_progress") => setNewStatus((s) => ({ key: (s?.key ?? 0) + 1, stage })),
  };

  const remove = () =>
    startDelete(async () => {
      if (!toDelete) return;
      const result = await deleteTask(toDelete.task.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${toDelete.task.title} deleted`);
      const then = toDelete.then;
      setToDelete(null);
      if (then) then();
      else router.refresh();
    });

  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}

      {options && form && (
        <TaskFormDialog
          key={form.key}
          open
          onOpenChange={(open) => !open && setForm(null)}
          task={form.draft}
          options={options}
          statuses={statuses}
        />
      )}

      {isAdmin && newStatus && (
        <StatusDialog
          key={newStatus.key}
          open
          onOpenChange={(open) => !open && setNewStatus(null)}
          kind="task"
          stages={TASK_STAGES}
          stage={newStatus.stage}
        />
      )}

      <RevisionsDialog
        request={feedback}
        onDone={(ok) => {
          feedback?.resolve(ok);
          setFeedback(null);
          if (ok) router.refresh();
        }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.task.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the task with its subtasks, comments, links and files. Time already logged on it stays in the
              timesheets. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                remove();
              }}
            >
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspaceContext.Provider>
  );
}

/** Sending work back: the feedback becomes a comment and goes into the editor's notification. */
function RevisionsDialog({ request, onDone }: { request: Feedback | null; onDone: (ok: boolean) => void }) {
  const [text, setText] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [shown, setShown] = React.useState(request);
  if (request !== shown) {
    setShown(request);
    if (request) setText("");
  }

  const send = () =>
    startTransition(async () => {
      if (!request) return;
      const { task, target, position } = request;
      const result = await moveTask(task.id, target.id, position, text);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Revisions requested", { description: "The editor has been notified with your feedback." });
      onDone(true);
    });

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && !pending && onDone(false)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Request revisions</DialogTitle>
          <DialogDescription>
            {request?.task.title} goes back to the editor. Tell them what to change: it&apos;s posted as a comment and sent with
            the notification.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && text.trim()) {
              event.preventDefault();
              send();
            }
          }}
          rows={4}
          autoFocus
          placeholder="e.g. Tighten the first 3 seconds and swap the music bed."
          aria-label="What to change"
          className="rounded-xl"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onDone(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={pending || !text.trim()}>
            {pending ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
            Send back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
