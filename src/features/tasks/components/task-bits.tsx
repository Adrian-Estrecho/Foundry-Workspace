import { CalendarIcon, FlagIcon } from "lucide-react";
import { daysBetween, formatDay } from "@/lib/dates";
import { PRIORITY_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import { taskStatusMeta, type TaskPriority, type TaskStatus } from "../constants";

export function TaskStatusChip({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = taskStatusMeta(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1", meta.chip, className)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
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
