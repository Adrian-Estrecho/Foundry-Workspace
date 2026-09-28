import { cn } from "@/lib/utils";
import { projectStatusMeta, type ProjectStatus } from "../constants";

export function ProjectStatusChip({ status, className }: { status: ProjectStatus; className?: string }) {
  const meta = projectStatusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-border",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}
