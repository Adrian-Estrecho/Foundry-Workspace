"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, ClipboardListIcon, Loader2Icon, MoreHorizontalIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { FormRow, submitWith } from "@/components/shared/form";
import { EmptyState, Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addDays } from "@/lib/dates";
import { firstName } from "@/lib/utils";
import { assignTrialTask, deleteTrialTask, reviewTrialTask } from "../../actions";
import { TrialTaskView, type TrialTask } from "../trial-task-view";

export function TrialTaskPanel({
  editorId,
  editorName,
  tasks,
  today,
  renderedAt,
}: {
  editorId: string;
  editorName: string;
  tasks: TrialTask[];
  today: string;
  renderedAt: number;
}) {
  const [assignOpen, setAssignOpen] = React.useState(false);
  const task = tasks[0];

  return (
    <Panel
      id="trial"
      title="Test edit & review"
      description={
        !task
          ? "A short, real task to see how they work. Passing it ticks the onboarding step."
          : task.status === "for_review"
            ? `${firstName(editorName)} handed it in. Your review is needed.`
            : task.status === "done"
              ? "Passed."
              : task.status === "revisions"
                ? `Changes requested. Waiting for ${firstName(editorName)} to send a new version.`
                : `Waiting for ${firstName(editorName)} to hand it in.`
      }
      action={task && <TaskMenu taskId={task.id} />}
    >
      {task ? (
        <div className="grid grid-cols-1 gap-4">
          <TrialTaskView task={task} today={today} renderedAt={renderedAt} />
          {task.status !== "done" && <ReviewForm taskId={task.id} editorName={editorName} highlighted={task.status === "for_review"} />}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardListIcon}
          title="No test edit yet"
          description={`Give ${firstName(editorName)} a short task to see how they work.`}
          action={
            <Button onClick={() => setAssignOpen(true)}>
              <PlusIcon /> Assign test edit
            </Button>
          }
        />
      )}
      <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} editorId={editorId} editorName={editorName} today={today} />
    </Panel>
  );
}

function ReviewForm({ taskId, editorName, highlighted }: { taskId: string; editorName: string; highlighted: boolean }) {
  const router = useRouter();
  const [feedback, setFeedback] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const review = (decision: "done" | "revisions") =>
    startTransition(async () => {
      const result = await reviewTrialTask(taskId, decision, feedback);
      if (!result.ok) return void toast.error(result.error);
      toast.success(decision === "done" ? "Test edit passed" : "Changes requested", {
        description: decision === "done" ? "The onboarding step is ticked." : `${firstName(editorName)} has been notified.`,
      });
      setFeedback("");
      router.refresh();
    });

  return (
    <div className={highlighted ? "grid gap-3 rounded-2xl border border-primary/40 p-4" : "grid gap-3 rounded-2xl border border-dashed p-4"}>
      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={3}
        placeholder="Feedback for them (required to request changes)"
        aria-label="Feedback"
        className="rounded-xl"
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => review("done")} disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Pass
        </Button>
        <Button variant="outline" onClick={() => review("revisions")} disabled={pending || !feedback.trim()}>
          <RotateCcwIcon /> Request changes
        </Button>
      </div>
    </div>
  );
}

function TaskMenu({ taskId }: { taskId: string }) {
  const router = useRouter();
  const remove = async () => {
    const result = await deleteTrialTask(taskId);
    if (!result.ok) return void toast.error(result.error);
    toast.success("Test edit deleted");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Test edit actions">
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl">
        <DropdownMenuItem variant="destructive" onSelect={() => void remove()}>
          <Trash2Icon /> Delete test edit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  editorId,
  editorName,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editorId: string;
  editorName: string;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await assignTrialTask(editorId, formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success("Test edit assigned", { description: `${firstName(editorName)} has been notified.` });
      setErrors({});
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Assign a test edit</DialogTitle>
          <DialogDescription>It shows on {firstName(editorName)}&apos;s onboarding page. They hand it in with a link.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submitWith(submit)} className="grid gap-4">
          <FormRow label="Title" required error={errors.title}>
            <Input name="title" defaultValue="Test edit · 30s product teaser" autoFocus required aria-invalid={!!errors.title} />
          </FormRow>
          <FormRow label="Brief" hint="What to make, where the footage is, format and length." error={errors.description}>
            <Textarea name="description" rows={5} className="rounded-xl" placeholder="Use the sample footage in the asset pack…" />
          </FormRow>
          <FormRow label="Due" error={errors.due_date}>
            <Input name="due_date" type="date" defaultValue={addDays(today, 3)} />
          </FormRow>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
