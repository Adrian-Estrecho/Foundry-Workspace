import Link from "next/link";
import { CalendarRangeIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatDay, toHours } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TimesheetRow } from "../queries";
import { attendanceHref } from "../views";

const hours = (seconds: number | undefined) => (seconds ? toHours(seconds).toFixed(1) : "—");

/**
 * One week of hours: people down the side, days across, with totals and the
 * hours each person planned per week. Admins click a day to open its log.
 */
export function Timesheet({
  days,
  rows,
  totals,
  total,
  today,
  isAdmin,
}: {
  days: string[];
  rows: TimesheetRow[];
  totals: Record<string, number>;
  total: number;
  today: string;
  isAdmin: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState icon={CalendarRangeIcon} title="No hours this week" description="Hours appear as editors start and stop work." />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[46rem] text-sm">
        <caption className="sr-only">Hours worked per day, week of {formatDay(days[0], { month: "long", day: "numeric" })}</caption>
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="sticky left-0 bg-card px-4 py-2.5 text-left font-medium">
              {isAdmin ? "Editor" : "You"}
            </th>
            {days.map((day) => (
              <th key={day} scope="col" className={cn("px-2 py-2.5 text-right font-medium tabular", day === today && "text-primary")}>
                {isAdmin ? (
                  <Link href={attendanceHref({ view: "log", date: day })} className="rounded hover:text-foreground">
                    {formatDay(day, { weekday: "short", day: "numeric" })}
                  </Link>
                ) : (
                  formatDay(day, { weekday: "short", day: "numeric" })
                )}
              </th>
            ))}
            <th scope="col" className="px-3 py-2.5 text-right font-medium">
              Total
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Planned
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const planned = row.weeklyHours ? row.weeklyHours * 3600 : null;
            const ratio = planned ? row.total / planned : null;
            return (
              <tr key={row.editorId} className="hover:bg-accent/30">
                <th scope="row" className="sticky left-0 bg-card px-4 py-2.5 text-left font-normal">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <UserAvatar name={row.name} src={row.avatarUrl} className="size-7" />
                    <span className="truncate font-medium">{row.name}</span>
                    {row.open && <span className="size-1.5 shrink-0 rounded-full bg-status-working" title="Working now" />}
                  </span>
                </th>
                {days.map((day) => (
                  <td
                    key={day}
                    className={cn(
                      "px-2 py-2.5 text-right tabular",
                      !row.perDay[day] && "text-muted-foreground/60",
                      day === today && "bg-primary/5",
                    )}
                  >
                    {hours(row.perDay[day])}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right font-semibold tabular">{hours(row.total)}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground tabular">
                  {planned ? (
                    <span className={cn(ratio !== null && ratio >= 1 && "text-success")}>
                      {row.weeklyHours}h <span className="text-xs">({Math.round((ratio ?? 0) * 100)}%)</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        {rows.length > 1 && (
          <tfoot className="border-t text-muted-foreground">
            <tr>
              <th scope="row" className="sticky left-0 bg-card px-4 py-2.5 text-left font-medium">
                Team
              </th>
              {days.map((day) => (
                <td key={day} className={cn("px-2 py-2.5 text-right tabular", day === today && "bg-primary/5")}>
                  {hours(totals[day])}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-semibold text-foreground tabular">{hours(total)}</td>
              <td className="px-4 py-2.5" />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
