"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, SquareIcon } from "lucide-react";
import { FormRow, NativeSelect, submitWith } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/lib/dates";
import { stopWork } from "../actions";
import type { WorkState } from "../queries";
import { useMyOpenTasks } from "./use-my-tasks";

/** A shift this long probably wasn't stopped when work ended. */
const LONG_SHIFT_MS = 10 * 60 * 60 * 1000;

/** "2026-09-29T17:30" in the browser's time zone, for datetime-local inputs. */
function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * The end-of-shift report: what got done, anything blocking, and progress
 * on the task. A shift left running for hours can be ended at the time work
 * really stopped.
 */
export function StopWorkDialog({
  open,
  onOpenChange,
  userId,
  state,
  workedSeconds,
  breakSeconds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  state: WorkState;
  workedSeconds: number;
  breakSeconds: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const tasks = useMyOpenTasks(userId, open);
  const [taskId, setTaskId] = React.useState(state.task?.id ?? "");
  const [progress, setProgress] = React.useState(state.task?.progress ?? 0);

  // Opening again starts from the task being worked on now.
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);
  const key = open ? `${state.clockInAt}:${state.task?.id ?? ""}` : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setTaskId(state.task?.id ?? "");
      setProgress(state.task?.progress ?? 0);
      setErrors({});
    }
  }

  const clockIn = state.clockInAt ? new Date(state.clockInAt) : null;
  const longShift = (workedSeconds + breakSeconds) * 1000 > LONG_SHIFT_MS;
  const options = [
    ...(state.task && !(tasks ?? []).some((t) => t.id === state.task!.id)
      ? [{ id: state.task.id, title: state.task.title, progress: state.task.progress }]
      : []),
    ...(tasks ?? []),
  ];

  const pickTask = (id: string) => {
    setTaskId(id);
    const task = options.find((t) => t.id === id);
    if (task) setProgress(task.progress);
  };

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const endedAt = String(formData.get("ended_local") ?? "");
      formData.delete("ended_local");
      if (endedAt) formData.set("ended_at", new Date(endedAt).toISOString());
      const result = await stopWork(formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success("Work stopped", { description: `${formatDuration(result.data.seconds)} logged. Nice work.` });
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Wrap up your shift</DialogTitle>
          <DialogDescription>
            {formatDuration(workedSeconds)} worked
            {breakSeconds >= 60 ? `, ${formatDuration(breakSeconds)} of breaks` : ""}. A quick report keeps the team in the loop.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
          <FormRow label="What did you get done?" required error={errors.work_done}>
            <Textarea
              name="work_done"
              required
              autoFocus
              rows={3}
              maxLength={4000}
              placeholder="Finished the rough cut of Reel 04 and uploaded it for review."
              aria-invalid={!!errors.work_done}
            />
          </FormRow>
          <FormRow label="Anything blocking you?" hint="The admins are told about blockers." error={errors.blockers}>
            <Textarea name="blockers" rows={2} maxLength={4000} placeholder="Waiting on the client's logo files." />
          </FormRow>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
            <FormRow label="Task" error={errors.task_id}>
              <NativeSelect name="task_id" value={taskId} onChange={(event) => pickTask(event.target.value)}>
                <option value="">No task</option>
                {options.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </NativeSelect>
            </FormRow>
            {taskId && (
              <FormRow label={`Progress · ${progress}%`} error={errors.progress}>
                <input
                  type="range"
                  name="progress"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(event) => setProgress(Number(event.target.value))}
                  className="h-10 w-full accent-primary"
                  aria-valuetext={`${progress}%`}
                />
              </FormRow>
            )}
          </div>
          {longShift && clockIn && (
            <FormRow
              label="Forgot to stop earlier?"
              hint="You started a long time ago. Set when you actually finished, or leave it empty to stop now."
              error={errors.ended_at}
            >
              <Input
                type="datetime-local"
                name="ended_local"
                min={localInputValue(clockIn)}
                max={localInputValue(new Date())}
                aria-invalid={!!errors.ended_at}
              />
            </FormRow>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Keep working
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <SquareIcon className="fill-current" />}
              Stop work
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
