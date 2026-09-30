import Link from "next/link";
import { AlertTriangleIcon, CalendarCheck2Icon } from "lucide-react";
import { EmptyState, Panel } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import { dueLabel } from "@/lib/dates";
import { PRIORITY_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { DueTask } from "./queries";

/**
 * Overdue tasks (highlighted red) and the week ahead, grouped by editor.
 */
export function Deadlines({ tasks, today, className }: { tasks: DueTask[]; today: string; className?: string }) {
  const overdue = tasks.filter((t) => t.dueDate < today);
  const upcoming = tasks.filter((t) => t.dueDate >= today);

  const byEditor = new Map<string, { name: string; avatar: string | null; tasks: DueTask[] }>();
  for (const task of upcoming) {
    const key = task.assigneeId ?? "unassigned";
    const group = byEditor.get(key) ?? { name: task.assigneeName ?? "Unassigned", avatar: task.assigneeAvatar, tasks: [] };
    group.tasks.push(task);
    byEditor.set(key, group);
  }

  return (
    <Panel
      className={className}
      title="Deadlines"
      description="Overdue work and everything due in the next 7 days"
      action={
        <Link href="/tasks" className="text-sm text-muted-foreground hover:text-foreground">
          All tasks
        </Link>
      }
    >
      {overdue.length > 0 && (
        <div className="mb-5 rounded-lg bg-danger/8 p-3 ring-1 ring-danger/25">
          <p className="mb-2 flex items-center gap-2 px-1 text-sm font-medium text-danger">
            <AlertTriangleIcon className="size-4" /> Overdue · {overdue.length}
          </p>
          <ul className="grid grid-cols-1 gap-1.5">
            {overdue.map((task) => (
              <TaskRow key={task.id} task={task} today={today} showAssignee overdue />
            ))}
          </ul>
        </div>
      )}

      {byEditor.size === 0 ? (
        <EmptyState icon={CalendarCheck2Icon} title="Nothing due this week" description="New deadlines will show up here." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {[...byEditor.entries()].map(([key, group]) => (
            <div key={key}>
              <div className="mb-2 flex items-center gap-2.5 px-1">
                <UserAvatar name={group.name} src={group.avatar} className="size-7" />
                <span className="text-sm font-medium">{group.name}</span>
                <span className="text-xs text-muted-foreground tabular">{group.tasks.length}</span>
              </div>
              <ul className="grid grid-cols-1 gap-1.5">
                {group.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} today={today} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function TaskRow({ task, today, showAssignee, overdue }: { task: DueTask; today: string; showAssignee?: boolean; overdue?: boolean }) {
  return (
    <li>
      <Link
        href={`/tasks/${task.id}`}
        className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5 ring-1 ring-border transition-colors hover:bg-accent/50"
      >
        <span className={cn("size-2 shrink-0 rounded-full bg-current", PRIORITY_META[task.priority].className)} title={`${PRIORITY_META[task.priority].label} priority`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{task.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {showAssignee && task.assigneeName ? `${task.assigneeName} · ` : ""}
            {task.context}
          </span>
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">{task.statusName}</span>
        <span className={cn("shrink-0 text-xs font-medium tabular", overdue ? "text-danger" : task.dueDate === today ? "text-warning" : "text-muted-foreground")}>
          {dueLabel(task.dueDate, today)}
        </span>
      </Link>
    </li>
  );
}
