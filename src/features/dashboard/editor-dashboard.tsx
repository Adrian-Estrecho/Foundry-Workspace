import Link from "next/link";
import {
  AlarmClockIcon,
  CalendarClockIcon,
  EyeIcon,
  ListTodoIcon,
  MegaphoneIcon,
  PinIcon,
  TimerIcon,
} from "lucide-react";
import { KpiTile } from "@/components/shared/kpi-tile";
import { EmptyState, PageHeader, Panel } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { StatusChip } from "@/components/shared/status";
import { Progress } from "@/components/ui/progress";
import type { CurrentUser } from "@/lib/auth";
import { dueLabel, formatDuration, greeting, timeAgo, toHours } from "@/lib/dates";
import { PRIORITY_META } from "@/lib/status";
import { cn, firstName } from "@/lib/utils";
import { CompletedBars } from "./completed-bars";
import { HoursChart } from "./hours-chart";
import type { getEditorDashboard } from "./queries";

type Data = Awaited<ReturnType<typeof getEditorDashboard>>;

/** An approved editor's "My day": status, deadlines and hours. */
export function EditorDashboard({ user, data }: { user: CurrentUser; data: Data }) {
  const { status, kpis, today } = data;
  const overdue = data.tasks.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = data.tasks.filter((t) => t.dueDate === today);
  const upcoming = data.tasks.filter((t) => !t.dueDate || t.dueDate > today).slice(0, 6);

  const working = status.workStatus === "working" || status.workStatus === "on_break";
  const sessionSeconds = status.clockInAt ? (data.renderedAt - new Date(status.clockInAt).getTime()) / 1000 : 0;

  return (
    <>
      <RealtimeRefresh channel="editor-dashboard" tables="tasks,editors" />

      <PageHeader
        title={`${greeting(data.timeZone)}, ${firstName(user.full_name)}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {working ? (
              <>
                <StatusChip status={status.workStatus === "working" ? "working" : "on_break"} />
                <span>
                  {status.taskTitle ?? "No task selected"} · started {formatDuration(sessionSeconds)} ago
                </span>
              </>
            ) : (
              <span>You&apos;re not working right now.</span>
            )}
          </span>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Due today" value={kpis.dueToday} icon={CalendarClockIcon} href="/my-tasks" />
        <KpiTile
          label="Overdue"
          value={kpis.overdue}
          icon={AlarmClockIcon}
          tone={kpis.overdue > 0 ? "danger" : "default"}
          href="/my-tasks"
        />
        <KpiTile label="Waiting for review" value={kpis.inReview} icon={EyeIcon} href="/my-tasks" />
        <KpiTile
          label="Hours this week"
          value={toHours(kpis.hoursThisWeek)}
          icon={TimerIcon}
          hint={kpis.weeklyHours ? `of ${kpis.weeklyHours}h planned` : undefined}
          href="/attendance"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="grid gap-5 xl:col-span-8">
          <Panel
            title="My tasks"
            action={
              <Link href="/my-tasks" className="text-sm text-muted-foreground hover:text-foreground">
                View all
              </Link>
            }
          >
            {data.tasks.length === 0 ? (
              <EmptyState icon={ListTodoIcon} title="No open tasks" description="New assignments will appear here." />
            ) : (
              <div className="grid gap-5">
                {overdue.length > 0 && <TaskGroup label="Overdue" tone="danger" tasks={overdue} today={today} />}
                {dueToday.length > 0 && <TaskGroup label="Today" tasks={dueToday} today={today} />}
                {upcoming.length > 0 && <TaskGroup label="Upcoming" tasks={upcoming} today={today} />}
              </div>
            )}
          </Panel>
          <HoursChart title="My hours" data={data.hours} today={today} weeklyCapacityHours={kpis.weeklyHours} />
        </div>

        <div className="grid content-start gap-5 xl:col-span-4">
          <Panel title="Latest announcement">
            {data.announcement ? (
              <Link href="/messages" className="group block rounded-lg bg-surface p-4 ring-1 ring-border hover:bg-accent/50">
                <p className="flex items-center gap-2 font-medium">
                  {data.announcement.is_pinned && <PinIcon className="size-4 text-primary" />}
                  {data.announcement.title}
                </p>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{data.announcement.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{timeAgo(data.announcement.created_at, data.renderedAt)}</p>
              </Link>
            ) : (
              <EmptyState icon={MegaphoneIcon} title="No announcements yet" />
            )}
          </Panel>

          <CompletedBars data={data.completed} />
        </div>
      </div>
    </>
  );
}

function TaskGroup({
  label,
  tasks,
  today,
  tone,
}: {
  label: string;
  tasks: Data["tasks"];
  today: string;
  tone?: "danger";
}) {
  return (
    <div className={cn(tone === "danger" && "rounded-lg bg-danger/8 p-3 ring-1 ring-danger/25")}>
      <p className={cn("mb-2 px-1 text-sm font-medium", tone === "danger" ? "text-danger" : "text-muted-foreground")}>
        {label} · {tasks.length}
      </p>
      <ul className="grid grid-cols-1 gap-1.5">
        {tasks.map((task) => (
          <li key={task.id}>
            <Link
              href={`/tasks/${task.id}`}
              className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5 ring-1 ring-border transition-colors hover:bg-accent/50"
            >
              <span className={cn("size-2 shrink-0 rounded-full bg-current", PRIORITY_META[task.priority].className)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{task.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {task.projectName} · {task.statusName}
                </span>
              </span>
              <span className="hidden w-20 sm:block">
                <Progress value={task.progress} className="h-1.5" />
              </span>
              {task.dueDate && (
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium tabular",
                    task.dueDate < today ? "text-danger" : task.dueDate === today ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  {dueLabel(task.dueDate, today)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
