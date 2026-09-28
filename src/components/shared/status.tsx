import { cn } from "@/lib/utils";
import { STATUS_META, type LiveStatus } from "@/lib/status";

export function StatusDot({ status, className }: { status: LiveStatus; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2.5 shrink-0", className)} aria-hidden="true">
      {status === "working" && (
        <span className="absolute inset-0 animate-ping rounded-full bg-status-working opacity-60 motion-reduce:hidden" />
      )}
      <span className={cn("relative inline-flex size-full rounded-full", STATUS_META[status].dot)} />
    </span>
  );
}

export function StatusChip({ status, className }: { status: LiveStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 whitespace-nowrap",
        STATUS_META[status].chip,
        className,
      )}
    >
      <StatusDot status={status} className="size-2" />
      {STATUS_META[status].label}
    </span>
  );
}
