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
import { deleteTask, moveTask, reassignTask, reviewTask, setTaskStatus } from "../actions";
import { EDITOR_STATUSES, taskStatusMeta, type TaskStatus } from "../constants";
import type { TaskFormOptions } from "../queries";
import { TaskFormDialog, type TaskDraft } from "./task-form-dialog";

type TaskRef = { id: string; title: string; status: TaskStatus };

type Workspace = {
  isAdmin: boolean;
  today: string;
  options: TaskFormOptions | null;
  /** Statuses this person may move a task to. */
  allowedStatuses: TaskStatus[];
  newTask: (draft?: TaskDraft) => void;
  editTask: (task: TaskDraft & { id: string }) => void;
  confirmDelete: (task: TaskRef, then?: () => void) => void;
  /** Status change from a menu or button (asks for feedback before Revisions). */
  changeStatus: (task: TaskRef, status: TaskStatus) => Promise<boolean>;
  /** Board drop: persists the move, asking for feedback first when dropped on Revisions. */
  dropOnStatus: (task: TaskRef, status: TaskStatus, position: number) => Promise<boolean>;
  assign: (task: TaskRef, editorId: string | null, editorName: string) => Promise<boolean>;
};

const WorkspaceContext = React.createContext<Workspace | null>(null);

export function useTaskWorkspace() {
  const workspace = React.useContext(WorkspaceContext);
  if (!workspace) throw new Error("useTaskWorkspace must be used inside <TaskWorkspace>.");
  return workspace;
}

type Feedback = { task: TaskRef; position: number | null; resolve: (ok: boolean) => void };

/**
 * Shared task behaviour for every view: the new/edit dialog, delete
 * confirmation, and status changes with the rules applied up front (editors
 * stop at For Review; Revisions asks the admin what to change).
 */
export function TaskWorkspace({
  isAdmin,
  today,
  options,
  children,
}: {
  isAdmin: boolean;
  today: string;
  options: TaskFormOptions | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<{ key: number; draft: TaskDraft } | null>(null);
  const [toDelete, setToDelete] = React.useState<{ task: TaskRef; then?: () => void } | null>(null);
  const [deleting, startDelete] = React.useTransition();
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const allowedStatuses = isAdmin ? (["todo", "in_progress", "for_review", "revisions", "done"] as TaskStatus[]) : EDITOR_STATUSES;

  const guard = (task: TaskRef, status: TaskStatus) => {
    if (isAdmin) return true;
    if (task.status === "done") {
      toast.error("This task is done. Ask an admin to reopen it.");
      return false;
    }
    if (!EDITOR_STATUSES.includes(status)) {
      toast.error(`Only an admin can move a task to ${taskStatusMeta(status).label}.`);
      return false;
    }
    return true;
  };

  const announce = (task: TaskRef, status: TaskStatus) =>
    toast.success(`${task.title} moved to ${taskStatusMeta(status).label}`, {
      description: status === "for_review" && !isAdmin ? "Foundry has been notified." : undefined,
    });

  const askFeedback = (task: TaskRef, position: number | null) =>
    new Promise<boolean>((resolve) => setFeedback({ task, position, resolve }));

  const workspace: Workspace = {
    isAdmin,
    today,
    options,
    allowedStatuses,
    newTask: (draft = {}) => setForm((f) => ({ key: (f?.key ?? 0) + 1, draft })),
    editTask: (task) => setForm((f) => ({ key: (f?.key ?? 0) + 1, draft: task })),
    confirmDelete: (task, then) => setToDelete({ task, then }),
    changeStatus: async (task, status) => {
      if (status === task.status || !guard(task, status)) return false;
      if (status === "revisions") return askFeedback(task, null);
      const result = await setTaskStatus(task.id, status);
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      announce(task, status);
      router.refresh();
      return true;
    },
    dropOnStatus: async (task, status, position) => {
      if (status !== task.status && !guard(task, status)) return false;
      if (status === "revisions" && task.status !== "revisions") return askFeedback(task, position);
      const result = await moveTask(task.id, status, position);
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      if (status !== task.status) announce(task, status);
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
      const { task, position } = request;
      const result =
        position === null ? await reviewTask(task.id, "revisions", text) : await moveTask(task.id, "revisions", position, text);
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
