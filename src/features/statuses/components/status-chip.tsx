import { cn } from "@/lib/utils";
import { statusColor, type StatusBadge } from "../constants";

export function StatusDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", statusColor(color).dot, className)} />;
}

/** A status in its colour: tinted chip with a dot. */
export function StatusChip({ status, className }: { status: Pick<StatusBadge, "name" | "color">; className?: string }) {
  const meta = statusColor(status.color);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1",
        meta.chip,
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />
      <span className="truncate">{status.name}</span>
    </span>
  );
}
