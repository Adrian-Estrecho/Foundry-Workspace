import { AlertTriangleIcon, CalendarOffIcon, Clock3Icon } from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatDay, formatDuration, formatTime, formatTimeOfDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { LogShift } from "../queries";

/**
 * Shifts with their end-of-shift reports. `groupByDay` adds a heading per
 * work date (an editor's own history); otherwise it's one day (the admin's
 * daily log), with who was scheduled but didn't work.
 */
export function ShiftLog({
  shifts,
  absent = [],
  showEditor = true,
  groupByDay = false,
  emptyText = "No shifts on this day.",
}: {
  shifts: LogShift[];
  absent?: { id: string; name: string; avatarUrl: string | null; shiftStart: string }[];
  showEditor?: boolean;
  groupByDay?: boolean;
  emptyText?: string;
}) {
  if (shifts.length === 0 && absent.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState icon={Clock3Icon} title={emptyText} description="Shifts appear here as soon as someone starts work." />
      </div>
    );
  }

  const days = groupByDay ? [...new Set(shifts.map((s) => s.workDate))] : [null];

  return (
    <div className="grid gap-5">
      {days.map((day) => {
        const list = day ? shifts.filter((s) => s.workDate === day) : shifts;
        const total = list.reduce((sum, s) => sum + s.workSeconds, 0);
        return (
          <section key={day ?? "day"} aria-label={day ? formatDay(day, { weekday: "long", month: "long", day: "numeric" }) : undefined}>
            {day && (
              <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                <h3 className="text-sm font-medium">{formatDay(day, { weekday: "long", month: "short", day: "numeric" })}</h3>
                <span className="text-xs text-muted-foreground tabular">{formatDuration(total)}</span>
              </div>
            )}
            <ul className="grid grid-cols-1 gap-2">
              {list.map((shift) => (
                <ShiftRow key={shift.id} shift={shift} showEditor={showEditor} />
              ))}
            </ul>
          </section>
        );
      })}

      {absent.length > 0 && (
        <section aria-label="Scheduled, no shift">
          <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">Scheduled, no shift</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {absent.map((editor) => (
              <li key={editor.id} className="flex items-center gap-3 rounded-xl border border-dashed p-3">
                <UserAvatar name={editor.name} src={editor.avatarUrl} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{editor.name}</span>
                  <span className="block text-xs text-muted-foreground">Due at {formatTimeOfDay(editor.shiftStart)} their time</span>
                </span>
                <CalendarOffIcon className="size-4 text-muted-foreground" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ShiftRow({ shift, showEditor }: { shift: LogShift; showEditor: boolean }) {
  const open = !shift.clockOutAt;
  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        {showEditor && <UserAvatar name={shift.editorName} src={shift.avatarUrl} className="size-9" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {showEditor && <span className="font-medium">{shift.editorName}</span>}
            {open && (
              <span className="rounded-full bg-status-working/12 px-2 py-0.5 text-xs font-medium text-status-working ring-1 ring-status-working/25">
                In progress
              </span>
            )}
            {shift.endedBy === "admin" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">Ended by an admin</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground tabular">
            {formatTime(shift.clockInAt, shift.timeZone)} – {shift.clockOutAt ? formatTime(shift.clockOutAt, shift.timeZone, true) : "now"}
            {shift.breakSeconds >= 60 && ` · ${formatDuration(shift.breakSeconds)} of breaks`}
          </p>
        </div>
        <span className={cn("shrink-0 font-heading text-lg font-semibold tabular", open && "text-status-working")}>
          {formatDuration(shift.workSeconds).replace("<1m", "0m")}
        </span>
      </div>

      {shift.report ? (
        <div className={cn("mt-3 grid gap-2 rounded-lg bg-surface p-3 text-sm ring-1 ring-border", showEditor && "sm:ml-12")}>
          <p className="break-words whitespace-pre-line">{shift.report.workDone}</p>
          {shift.report.blockers && (
            <p className="flex gap-2 rounded-md bg-warning/10 p-2 text-warning ring-1 ring-warning/25">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              <span className="break-words whitespace-pre-line">{shift.report.blockers}</span>
            </p>
          )}
          {(shift.report.taskTitle || shift.report.progress !== null) && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="min-w-0 truncate">{shift.report.taskTitle ?? "A task"}</span>
              {shift.report.progress !== null && (
                <>
                  <span className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-foreground/10">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${shift.report.progress}%` }} />
                  </span>
                  <span className="tabular">{shift.report.progress}%</span>
                </>
              )}
            </p>
          )}
        </div>
      ) : (
        !open && <p className={cn("mt-2 text-xs text-muted-foreground", showEditor && "sm:ml-12")}>No report for this shift.</p>
      )}
    </li>
  );
}
