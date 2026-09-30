import { StatusDot } from "@/features/statuses/components/status-chip";
import type { StatusBadge } from "@/features/statuses/constants";
import { cn } from "@/lib/utils";

/** The project's status: a quiet chip with the status's coloured dot. */
export function ProjectStatusChip({ status, className }: { status: Pick<StatusBadge, "name" | "color">; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-border",
        className,
      )}
    >
      <StatusDot color={status.color} className="size-1.5" />
      <span className="truncate">{status.name}</span>
    </span>
  );
}
