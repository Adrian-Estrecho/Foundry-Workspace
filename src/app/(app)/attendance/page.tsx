import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClockIcon, ChevronLeftIcon, ChevronRightIcon, CoffeeIcon, DownloadIcon, TimerIcon } from "lucide-react";
import { KpiTile } from "@/components/shared/kpi-tile";
import { PageHeader, Panel } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoursReport } from "@/features/attendance/components/hours-report";
import { LiveBoard } from "@/features/attendance/components/live-board";
import { ShiftLog } from "@/features/attendance/components/shift-log";
import { Timesheet } from "@/features/attendance/components/timesheet";
import { getHours, getLiveBoard, getShiftLog, getTimesheet } from "@/features/attendance/queries";
import {
  ADMIN_VIEWS,
  EDITOR_VIEWS,
  RANGE_PRESETS,
  attendanceHref,
  parseAttendanceParams,
  presetRange,
  type AttendanceParams,
} from "@/features/attendance/views";
import { requireUser } from "@/lib/auth";
import { addDays, formatDay, formatDuration, startOfWeek, todayIn, toHours } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Attendance" };

/**
 * Admins: the live board, a daily log with end-of-shift reports, weekly
 * timesheets and hours per project. Editors: their own time, timesheet and
 * hours. Everything exports to CSV.
 */
export default async function AttendancePage(props: PageProps<"/attendance">) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const today = todayIn(user.timezone);
  const params = parseAttendanceParams(await props.searchParams, { isAdmin, today });
  const views = isAdmin ? ADMIN_VIEWS : EDITOR_VIEWS;

  return (
    <>
      <RealtimeRefresh channel="attendance" tables="editors,shifts" />
      <PageHeader
        title="Attendance"
        description={
          isAdmin
            ? `Who's working at ${user.workspace.name}, and the hours behind it.`
            : "Your shifts, reports and hours. Start and stop work from the top bar."
        }
        actions={<ExportButton params={params} />}
      />

      <nav aria-label="Attendance views" className="mb-4 inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-0.5 scrollbar-none">
        {views.map((view) => {
          const active = view.value === params.view;
          return (
            <Link
              key={view.value}
              href={attendanceHref({ view: view.value })}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {view.label}
            </Link>
          );
        })}
      </nav>

      <View params={params} today={today} user={user} />
    </>
  );
}

async function View({ params, today, user }: { params: AttendanceParams; today: string; user: Awaited<ReturnType<typeof requireUser>> }) {
  const isAdmin = user.role === "admin";

  switch (params.view) {
    case "live": {
      const { editors, renderedAt } = await getLiveBoard(user);
      return <LiveBoard editors={editors} renderedAt={renderedAt} />;
    }

    case "log": {
      const { shifts, absent } = await getShiftLog(user, params.date, params.date);
      return (
        <>
          <PeriodNav
            label={formatDay(params.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            prev={attendanceHref({ view: "log", date: addDays(params.date, -1) })}
            next={params.date < today ? attendanceHref({ view: "log", date: addDays(params.date, 1) }) : null}
            reset={params.date !== today ? { label: "Today", href: attendanceHref({ view: "log" }) } : null}
          />
          <ShiftLog shifts={shifts} absent={absent} />
        </>
      );
    }

    case "timesheet": {
      const sheet = await getTimesheet(user, params.week);
      const thisWeek = startOfWeek(today);
      return (
        <>
          <PeriodNav
            label={`Week of ${formatDay(params.week, { month: "long", day: "numeric", year: "numeric" })}`}
            prev={attendanceHref({ view: "timesheet", week: addDays(params.week, -7) })}
            next={params.week < thisWeek ? attendanceHref({ view: "timesheet", week: addDays(params.week, 7) }) : null}
            reset={params.week !== thisWeek ? { label: "This week", href: attendanceHref({ view: "timesheet" }) } : null}
          />
          <Timesheet {...sheet} today={today} isAdmin={isAdmin} />
          <p className="mt-2 text-xs text-muted-foreground">
            Hours by the day each shift started, in each person&apos;s own time zone.
          </p>
        </>
      );
    }

    case "hours": {
      const data = await getHours(user, params.from, params.to);
      return (
        <>
          <RangePicker params={params} today={today} />
          <HoursReport {...data} isAdmin={isAdmin} />
        </>
      );
    }

    case "mine": {
      const weekStart = startOfWeek(today);
      const [sheet, log] = await Promise.all([getTimesheet(user, weekStart), getShiftLog(user, addDays(today, -13), today)]);
      const me = sheet.rows[0];
      const todays = log.shifts.filter((s) => s.workDate === today);
      const worked = todays.reduce((sum, s) => sum + s.workSeconds, 0);
      const breaks = todays.reduce((sum, s) => sum + s.breakSeconds, 0);
      return (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Worked today" value={formatDuration(worked).replace("<1m", "0h")} icon={TimerIcon} />
            <KpiTile label="Breaks today" value={breaks >= 60 ? formatDuration(breaks) : "—"} icon={CoffeeIcon} />
            <KpiTile
              label="This week"
              value={`${toHours(me?.total ?? 0)}h`}
              icon={CalendarClockIcon}
              hint={me?.weeklyHours ? `of ${me.weeklyHours}h planned` : undefined}
            />
            <KpiTile
              label="Shifts this week"
              value={log.shifts.filter((s) => s.workDate >= weekStart).length}
              icon={CalendarClockIcon}
            />
          </div>
          <Panel title="Last two weeks" description="Your shifts and end-of-shift reports.">
            <ShiftLog shifts={log.shifts} showEditor={false} groupByDay emptyText="No shifts in the last two weeks." />
          </Panel>
        </>
      );
    }
  }
}

function PeriodNav({
  label,
  prev,
  next,
  reset,
}: {
  label: string;
  prev: string;
  next: string | null;
  reset: { label: string; href: string } | null;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <h2 className="mr-auto font-heading text-lg font-medium">{label}</h2>
      {reset && (
        <Button asChild variant="outline" size="sm">
          <Link href={reset.href} scroll={false}>
            {reset.label}
          </Link>
        </Button>
      )}
      <Button asChild variant="outline" size="icon-sm">
        <Link href={prev} scroll={false} aria-label="Previous">
          <ChevronLeftIcon />
        </Link>
      </Button>
      {next ? (
        <Button asChild variant="outline" size="icon-sm">
          <Link href={next} scroll={false} aria-label="Next">
            <ChevronRightIcon />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="icon-sm" disabled aria-label="Next">
          <ChevronRightIcon />
        </Button>
      )}
    </div>
  );
}

/** Presets as links, plus a plain GET form for any range (works without JavaScript). */
function RangePicker({ params, today }: { params: AttendanceParams; today: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="mr-auto flex flex-wrap gap-1.5">
        {RANGE_PRESETS.map((preset) => {
          const range = presetRange(preset.value, today);
          const active = range.from === params.from && range.to === params.to;
          return (
            <Link
              key={preset.value}
              href={attendanceHref({ view: "hours", ...range })}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                active ? "border-primary/60 bg-primary/12 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {preset.label}
            </Link>
          );
        })}
      </div>
      <form action="/attendance" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="view" value="hours" />
        <Input type="date" name="from" defaultValue={params.from} max={today} aria-label="From" className="h-8 w-auto" />
        <span className="text-sm text-muted-foreground">to</span>
        <Input type="date" name="to" defaultValue={params.to} max={today} aria-label="To" className="h-8 w-auto" />
        <Button type="submit" variant="secondary" size="sm">
          Show
        </Button>
      </form>
    </div>
  );
}

/** CSV of what's on screen: the day's shifts, the week's timesheet, or the range's hours. */
function ExportButton({ params }: { params: AttendanceParams }) {
  const search = new URLSearchParams();
  switch (params.view) {
    case "timesheet":
      search.set("type", "timesheet");
      search.set("from", params.week);
      search.set("to", addDays(params.week, 6));
      break;
    case "hours":
      search.set("type", "hours");
      search.set("from", params.from);
      search.set("to", params.to);
      break;
    case "log":
      search.set("type", "shifts");
      search.set("from", params.date);
      search.set("to", params.date);
      break;
    default:
      search.set("type", "shifts");
      search.set("from", addDays(params.date, -29));
      search.set("to", params.date);
  }
  return (
    <Button asChild variant="outline">
      <a href={`/attendance/export?${search}`} download>
        <DownloadIcon /> Export CSV
      </a>
    </Button>
  );
}
