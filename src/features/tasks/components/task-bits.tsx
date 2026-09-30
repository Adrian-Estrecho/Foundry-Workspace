import { CalendarIcon, FlagIcon } from "lucide-react";
import { daysBetween, formatDay } from "@/lib/dates";
import { StatusChip } from "@/features/statuses/components/status-chip";
import type { StatusBadge } from "@/features/statuses/constants";
import { PRIORITY_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "../constants";

/** The task's status (the workspace's own name and colour). */
export function TaskStatusChip({ status, className }: { status: Pick<StatusBadge, "name" | "color">; className?: string }) {
  return <StatusChip status={status} className={className} />;
}

export function PriorityFlag({ priority, className }: { priority: TaskPriority; className?: string }) {
  const meta = PRIORITY_META[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap", meta.className, className)} title={`${meta.label} priority`}>
      <FlagIcon className="size-3" />
      {meta.label}
    </span>
  );
}

/** "Today", "Tomorrow", "Oct 2", or "2d overdue" in red. Done tasks stay neutral. */
export function shortDue(dueDate: string, today: string) {
  const diff = daysBetween(today, dueDate);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${-diff}d overdue`;
  return formatDay(dueDate, { month: "short", day: "numeric" });
}

export function dueTone(dueDate: string | null, today: string, done: boolean) {
  if (!dueDate || done) return "text-muted-foreground";
  if (dueDate < today) return "text-danger";
  if (dueDate === today) return "text-warning";
  return "text-muted-foreground";
}

export function DueChip({ dueDate, today, done, className }: { dueDate: string | null; today: string; done: boolean; className?: string }) {
  if (!dueDate) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap tabular", dueTone(dueDate, today, done), className)}>
      <CalendarIcon className="size-3" />
      {done ? formatDay(dueDate, { month: "short", day: "numeric" }) : shortDue(dueDate, today)}
    </span>
  );
}
