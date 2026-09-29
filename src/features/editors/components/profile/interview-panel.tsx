"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClockIcon, CheckIcon, Loader2Icon, VideoIcon, XIcon } from "lucide-react";
import { FormRow } from "@/components/shared/form";
import { EmptyState, Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, firstName } from "@/lib/utils";
import type { Enums } from "@/types/database";
import { INTERVIEW_OUTCOME as OUTCOME, interviewTime } from "../../interview";
import { scheduleInterview, setInterviewOutcome } from "../../review-actions";

export type Interview = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  note_to_editor: string | null;
  outcome: Enums<"interview_outcome">;
};

/** The browser's local "YYYY-MM-DDTHH:mm", for a datetime-local input. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The interview step: book it (the editor gets a notification and an
 * email), move it, then mark how it went. Passing ticks the onboarding step.
 */
export function InterviewPanel({
  editorId,
  editorName,
  editorTimeZone,
  adminTimeZone,
  interviews,
}: {
  editorId: string;
  editorName: string;
  editorTimeZone: string;
  adminTimeZone: string;
  interviews: Interview[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const current = interviews.find((i) => i.outcome !== "cancelled") ?? null;
  const name = firstName(editorName);

  const decide = (outcome: "passed" | "failed" | "cancelled") =>
    startTransition(async () => {
      if (!current) return;
      const result = await setInterviewOutcome(current.id, outcome);
      if (!result.ok) return void toast.error(result.error);
      toast.success(
        outcome === "passed" ? "Interview passed" : outcome === "failed" ? "Marked as didn't pass" : "Interview cancelled",
        { description: outcome === "passed" ? "The onboarding step is ticked." : undefined },
      );
      router.refresh();
    });

  return (
    <Panel
      id="interview"
      title="Interview"
      description={
        !current
          ? `Book a call with ${name} once you've seen their test edit.`
          : current.outcome === "scheduled"
            ? `${name} has the details on their onboarding page.`
            : undefined
      }
      action={
        current?.outcome !== "passed" && (
          <Button size="sm" variant="secondary" className="bg-surface ring-1 ring-border" onClick={() => setDialogOpen(true)}>
            <CalendarClockIcon /> {current?.outcome === "scheduled" ? "Move" : "Book interview"}
          </Button>
        )
      }
    >
      {!current ? (
        <EmptyState icon={VideoIcon} title="No interview booked" description="Pick a time and add a meeting link." />
      ) : (
        <div className="grid gap-3">
          <div className="rounded-lg bg-surface p-4 ring-1 ring-border">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 font-medium">{interviewTime(current.scheduled_at, adminTimeZone)}</p>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", OUTCOME[current.outcome].className)}>
                {OUTCOME[current.outcome].label}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {current.duration_minutes} min · {interviewTime(current.scheduled_at, editorTimeZone)} for {name}
            </p>
            {current.meeting_url && (
              <a
                href={current.meeting_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <VideoIcon className="size-4" /> Join the call
              </a>
            )}
            {current.note_to_editor && (
              <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{current.note_to_editor}</p>
            )}
          </div>
          {current.outcome === "scheduled" && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => decide("passed")} disabled={pending}>
                {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Passed
              </Button>
              <Button variant="outline" onClick={() => decide("failed")} disabled={pending}>
                <XIcon /> Didn&apos;t pass
              </Button>
              <Button variant="ghost" onClick={() => decide("cancelled")} disabled={pending}>
                Cancel interview
              </Button>
            </div>
          )}
          {current.outcome === "failed" && (
            <p className="text-sm text-muted-foreground">
              You can book another interview, or decide on {name} below.
            </p>
          )}
        </div>
      )}

      <ScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editorId={editorId}
        editorName={name}
        current={current?.outcome === "scheduled" ? current : null}
      />
    </Panel>
  );
}

function ScheduleDialog({
  open,
  onOpenChange,
  editorId,
  editorName,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editorId: string;
  editorName: string;
  current: Interview | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const local = String(formData.get("when") ?? "");
    const at = local ? new Date(local) : null;
    if (!at || Number.isNaN(at.getTime())) return setErrors({ scheduled_at: "Pick a date and time." });
    if (at.getTime() < Date.now()) return setErrors({ scheduled_at: "Pick a time in the future." });
    formData.set("scheduled_at", at.toISOString());
    formData.delete("when");

    startTransition(async () => {
      const result = await scheduleInterview(editorId, formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success(current ? "Interview moved" : "Interview booked", { description: `${editorName} has been emailed the details.` });
      setErrors({});
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{current ? "Move the interview" : `Book an interview with ${editorName}`}</DialogTitle>
          <DialogDescription>
            In your local time. {editorName} sees it in theirs, on their onboarding page and in an email.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Date and time" required error={errors.scheduled_at}>
            <Input
              name="when"
              type="datetime-local"
              defaultValue={current ? toLocalInput(current.scheduled_at) : undefined}
              required
              aria-invalid={!!errors.scheduled_at}
            />
          </FormRow>
          <FormRow label="Length (minutes)" error={errors.duration_minutes}>
            <Input name="duration_minutes" type="number" min={5} max={240} step={5} defaultValue={current?.duration_minutes ?? 30} />
          </FormRow>
          <FormRow label="Meeting link" hint="Zoom, Google Meet, Teams…" error={errors.meeting_url} className="sm:col-span-2">
            <Input
              name="meeting_url"
              type="url"
              placeholder="https://meet.google.com/…"
              defaultValue={current?.meeting_url ?? ""}
              aria-invalid={!!errors.meeting_url}
            />
          </FormRow>
          <FormRow label="Note for them (optional)" error={errors.note_to_editor} className="sm:col-span-2">
            <Textarea
              name="note_to_editor"
              rows={3}
              className="rounded-xl"
              placeholder="What to expect, anything to prepare…"
              defaultValue={current?.note_to_editor ?? ""}
            />
          </FormRow>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <CalendarClockIcon />}
              {current ? "Move interview" : "Book interview"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
