"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRightIcon, ChevronDownIcon, Clock3Icon, CoffeeIcon, Loader2Icon, PlayIcon, SquareIcon } from "lucide-react";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { StatusDot } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNow } from "@/hooks/use-now";
import { formatClock, formatDuration } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-result";
import { resumeWork, startWork, switchTask, takeBreak } from "../actions";
import type { WorkState } from "../queries";
import { StopWorkDialog } from "./stop-work-dialog";
import { TaskPicker } from "./task-picker";
import { useMyOpenTasks } from "./use-my-tasks";

type Mode = "menu" | "pick";

/**
 * The editor's clock, in the top bar. Off: "Start work" with a task picker.
 * Working: a running timer with the task, plus switch task, break and stop.
 * On break: the break timer and "Resume". Stopping asks for the
 * end-of-shift report. Changes made elsewhere (another tab, or an admin
 * ending the shift) arrive over Realtime.
 */
export function WorkControl({ userId, state, today }: { userId: string; state: WorkState; today: string }) {
  const router = useRouter();
  const now = useNow(state.renderedAt);
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("menu");
  const [stopOpen, setStopOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const tasks = useMyOpenTasks(userId, open && mode === "pick");

  const working = state.status === "working";
  const onBreak = state.status === "on_break";
  const stretch = working && state.stretchStartedAt ? Math.max(0, (now - Date.parse(state.stretchStartedAt)) / 1000) : 0;
  const worked = state.workedBefore + stretch;
  const shiftElapsed = state.clockInAt ? Math.max(0, (now - Date.parse(state.clockInAt)) / 1000) : 0;
  const breaks = Math.max(0, shiftElapsed - worked);
  const onBreakFor = onBreak ? Math.max(0, (now - Date.parse(state.statusSince)) / 1000) : 0;

  const run = (action: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.error);
      toast.success(success);
      setOpen(false);
      router.refresh();
    });

  const pick = (taskId: string | null) => {
    if (state.status === "off") run(() => startWork(taskId), "You're working. The clock is running.");
    else if (onBreak) run(() => resumeWork(taskId), "Welcome back");
    else run(() => switchTask(taskId), "Switched task");
  };

  const openChange = (value: boolean) => {
    setOpen(value);
    if (value) setMode(state.status === "off" ? "pick" : "menu");
  };

  if (!state.active) {
    return (
      <span className="hidden text-xs text-muted-foreground sm:inline" title="An admin has paused your account in this workspace.">
        Time tracking paused
      </span>
    );
  }

  return (
    <>
      <RealtimeRefresh channel="work-control" tables="editors" />
      <Popover open={open} onOpenChange={openChange}>
        <PopoverTrigger asChild>
          {state.status === "off" ? (
            <Button size="sm" className="gap-1.5" aria-label="Start work">
              <PlayIcon className="fill-current" />
              <span className="hidden sm:inline">Start work</span>
            </Button>
          ) : (
            <button
              type="button"
              aria-label={working ? `Working, ${formatClock(worked)}. Open time tracking` : `On break, ${formatClock(onBreakFor)}. Open time tracking`}
              className={cn(
                "inline-flex h-8 max-w-72 items-center gap-2 rounded-lg px-2.5 text-sm ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                working
                  ? "bg-status-working/10 ring-status-working/30 hover:bg-status-working/15"
                  : "bg-status-break/10 ring-status-break/30 hover:bg-status-break/15",
              )}
            >
              <StatusDot status={working ? "working" : "on_break"} className="size-2" />
              <span className={cn("font-medium tabular", working ? "text-status-working" : "text-status-break")}>
                {working ? formatClock(worked) : formatClock(onBreakFor)}
              </span>
              <span className="hidden min-w-0 truncate text-muted-foreground md:inline">
                {working ? (state.task?.title ?? "No specific task") : "On break"}
              </span>
              <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}
        </PopoverTrigger>

        <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] gap-3 rounded-xl p-3">
          {mode === "pick" ? (
            <>
              <div className="px-1">
                <p className="font-heading font-medium">
                  {state.status === "off" ? "What are you working on?" : onBreak ? "Resume on which task?" : "Switch to"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {state.status === "off" ? "Pick a task and the clock starts. You can switch any time." : "The clock moves with you."}
                </p>
              </div>
              <TaskPicker tasks={tasks} today={today} currentId={state.status === "off" ? undefined : (state.task?.id ?? null)} onPick={pick} disabled={pending} />
              {state.status !== "off" && (
                <Button variant="ghost" size="sm" onClick={() => setMode("menu")}>
                  Back
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="rounded-lg bg-surface p-3 ring-1 ring-border">
                <p className="text-xs text-muted-foreground">{working ? "Working on" : "Before your break"}</p>
                <p className="mt-0.5 truncate font-medium">{state.task?.title ?? "No specific task"}</p>
                {state.task?.projectName && <p className="truncate text-xs text-muted-foreground">{state.task.projectName}</p>}
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Worked this shift</dt>
                    <dd className="font-medium tabular">{formatDuration(worked)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{onBreak ? "On break for" : "Breaks"}</dt>
                    <dd className="font-medium tabular">{formatDuration(onBreak ? onBreakFor : breaks)}</dd>
                  </div>
                </dl>
              </div>
              <div className="grid gap-1.5">
                {working ? (
                  <>
                    <Button variant="secondary" className="justify-start" onClick={() => setMode("pick")} disabled={pending}>
                      <ArrowLeftRightIcon /> Switch task
                    </Button>
                    <Button variant="secondary" className="justify-start" onClick={() => run(takeBreak, "Enjoy your break")} disabled={pending}>
                      {pending ? <Loader2Icon className="animate-spin" /> : <CoffeeIcon />} Take a break
                    </Button>
                  </>
                ) : (
                  <>
                    <Button className="justify-start" onClick={() => run(() => resumeWork(), "Welcome back")} disabled={pending}>
                      {pending ? <Loader2Icon className="animate-spin" /> : <PlayIcon className="fill-current" />}
                      {state.task ? "Resume" : "Resume work"}
                    </Button>
                    <Button variant="secondary" className="justify-start" onClick={() => setMode("pick")} disabled={pending}>
                      <ArrowLeftRightIcon /> Resume on another task
                    </Button>
                  </>
                )}
                <Button
                  variant="secondary"
                  className="justify-start"
                  onClick={() => {
                    setOpen(false);
                    setStopOpen(true);
                  }}
                  disabled={pending}
                >
                  <SquareIcon className="fill-current" /> Stop work
                </Button>
              </div>
              <Link href="/attendance" onClick={() => setOpen(false)} className="px-1 text-xs text-muted-foreground hover:text-foreground">
                <Clock3Icon className="mr-1 inline size-3" />
                Your time and timesheet
              </Link>
            </>
          )}
        </PopoverContent>
      </Popover>

      <StopWorkDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        userId={userId}
        state={state}
        workedSeconds={worked}
        breakSeconds={breaks}
      />
    </>
  );
}
