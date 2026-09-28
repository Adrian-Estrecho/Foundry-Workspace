import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { MonthlyCount } from "./queries";

/** Tasks completed per month; the current month is highlighted. */
export function CompletedBars({ data, className }: { data: MonthlyCount[]; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.completed));
  const current = data.at(-1)?.completed ?? 0;
  const previous = data.at(-2)?.completed ?? 0;
  const total = data.reduce((sum, d) => sum + d.completed, 0);
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : null;

  return (
    <Panel
      className={className}
      title="Tasks completed"
      description={
        <span className="flex items-baseline gap-2">
          <span className="font-heading text-2xl font-semibold text-foreground tabular">{total}</span>
          <span>in 6 months</span>
          {delta !== null && (
            <span className={cn("inline-flex items-center text-sm font-medium tabular", delta >= 0 ? "text-success" : "text-danger")}>
              {delta >= 0 ? <ArrowUpRightIcon className="size-4" /> : <ArrowDownRightIcon className="size-4" />}
              {Math.abs(delta).toFixed(0)}% vs last month
            </span>
          )}
        </span>
      }
    >
      <div className="mt-auto flex h-56 items-end gap-2 sm:gap-3" role="img" aria-label="Tasks completed per month">
        {data.map((d, i) => {
          const highlight = i === data.length - 1;
          const height = Math.max(8, (d.completed / max) * 100);
          return (
            <div key={d.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span
                className={cn(
                  "text-sm tabular",
                  highlight ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {d.completed}
              </span>
              <div
                className={cn(
                  "w-full rounded-md",
                  highlight ? "bg-primary" : "bg-muted",
                )}
                style={{ height: `${height}%` }}
              />
              <span className="text-xs text-muted-foreground">{formatDay(d.month, { month: "short" })}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
