"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, SendIcon } from "lucide-react";
import { FormRow, submitWith } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitTrialTask } from "../../onboarding-actions";
import { TrialTaskView, type TrialTask } from "../trial-task-view";

export function TrialStep({
  tasks,
  today,
  renderedAt,
  workspaceName,
}: {
  tasks: TrialTask[];
  today: string;
  renderedAt: number;
  workspaceName: string;
}) {
  const task = tasks[0];
  if (!task) {
    return (
      <p className="text-sm text-muted-foreground">
        {workspaceName} will send your test edit soon. You&apos;ll get a notification, and it will appear here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <TrialTaskView task={task} today={today} renderedAt={renderedAt} />
      {task.status !== "done" && <SubmitForm task={task} />}
    </div>
  );
}

function SubmitForm({ task }: { task: TrialTask }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formKey, setFormKey] = React.useState(0);
  const inReview = task.status === "for_review";

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await submitTrialTask(task.id, formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success(inReview ? "Updated link sent" : "Sent for review", { description: "They'll take a look and get back to you." });
      setErrors({});
      setFormKey((k) => k + 1);
      router.refresh();
    });

  return (
    <form key={formKey} onSubmit={submitWith(submit)} className="grid gap-3 rounded-2xl border border-dashed p-4">
      <p className="text-sm font-medium">
        {inReview ? "Sent for review. Need to send a newer version?" : task.status === "revisions" ? "Send your revised edit" : "Hand in your edit"}
      </p>
      <FormRow label="Link to your edit" error={errors.url}>
        <Input name="url" type="url" placeholder="https://frame.io/…" aria-invalid={!!errors.url} required />
      </FormRow>
      <FormRow label="Note (optional)" error={errors.note}>
        <Textarea name="note" rows={2} className="rounded-xl" placeholder="Anything we should know?" />
      </FormRow>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
        {inReview ? "Send updated link" : "Send for review"}
      </Button>
    </form>
  );
}
