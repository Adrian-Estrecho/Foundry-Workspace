"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRightIcon, ArrowUpRightIcon, CalendarIcon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Segmented } from "@/components/shared/segmented";
import { addDays, formatDay, startOfWeek, toHours } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { DailyHours } from "./queries";

type Range = "1m" | "3m" | "6m";
const RANGES: { value: Range; label: string }[] = [
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
];

type Point = { key: string; hours: number; tooltip: string; tick: string | null };

/** Sums daily rows into Monday-start weeks. */
function toWeeks(data: DailyHours[]) {
  const weeks = new Map<string, number>();
  for (const { day, seconds } of data) {
    const week = startOfWeek(day);
    weeks.set(week, (weeks.get(week) ?? 0) + seconds);
  }
  return [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, seconds]) => ({ week, seconds }));
}

function buildSeries(data: DailyHours[], range: Range, today: string) {
  if (range === "1m") {
    const from = addDays(today, -29);
    const prevFrom = addDays(today, -59);
    const current = data.filter((d) => d.day >= from && d.day <= today);
    const previous = data.filter((d) => d.day >= prevFrom && d.day < from);
    const points: Point[] = current.map((d, i) => ({
      key: d.day,
      hours: toHours(d.seconds),
      tooltip: formatDay(d.day, { weekday: "short", day: "2-digit", month: "short" }),
      // Weekly labels; none on the first point, where it would be clipped.
      tick: i > 0 && i % 7 === 0 ? formatDay(d.day, { month: "short", day: "numeric" }) : null,
    }));
    return { points, current: current.map((d) => d.seconds), previous: previous.map((d) => d.seconds) };
  }

  const count = range === "3m" ? 13 : 26;
  const weeks = toWeeks(data);
  const current = weeks.slice(-count);
  const previous = weeks.slice(-count * 2, -count);
  let lastMonth = "";
  const points: Point[] = current.map(({ week, seconds }, i) => {
    const month = formatDay(week, { month: "short" });
    // Label the first week of each month (not the partial month at the left edge).
    const tick = i > 0 && month !== lastMonth ? month : null;
    lastMonth = month;
    return { key: week, hours: toHours(seconds), tooltip: `Week of ${formatDay(week, { day: "2-digit", month: "short" })}`, tick };
  });
  return { points, current: current.map((w) => w.seconds), previous: previous.map((w) => w.seconds) };
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Only what the tooltip reads from recharts content props. */
type TooltipArgs = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> };

function ChartTooltip({ active, payload }: TooltipArgs) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as Point;
  return (
    <div className="rounded-lg bg-foreground px-3 py-2 text-background shadow-md">
      <div className="flex items-center gap-1.5 text-xs opacity-70">
        {point.tooltip} <ArrowUpRightIcon className="size-3" />
      </div>
      <div className="font-heading text-sm font-semibold tabular">{point.hours.toLocaleString()} hours</div>
    </div>
  );
}

export function HoursChart({
  title,
  data,
  today,
  weeklyCapacityHours,
  className,
}: {
  title: string;
  data: DailyHours[];
  today: string;
  /** Combined weekly hours the team is contracted for; drives the capacity strip. */
  weeklyCapacityHours?: number | null;
  className?: string;
}) {
  const [range, setRange] = React.useState<Range>("6m");
  const gradientId = React.useId();
  const { points, current, previous } = React.useMemo(() => buildSeries(data, range, today), [data, range, today]);

  const total = sum(current);
  const previousTotal = sum(previous);
  const delta = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null;
  const workedDays = data.filter((d) => d.seconds > 0 && d.day >= (points[0]?.key ?? today)).length;
  const perDay = workedDays ? toHours(total / workedDays) : 0;

  // Weekly capacity strip under the chart.
  const thisWeek = startOfWeek(today);
  const weeks = toWeeks(data).filter((w) => w.week >= startOfWeek(points[0]?.key ?? today));
  const target = (weeklyCapacityHours ?? 0) * 0.85 * 3600;

  return (
    <Panel className={cn("gap-1", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-base font-medium">{title}</h2>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-heading text-3xl font-semibold tracking-tight tabular">
              {toHours(total).toLocaleString()}
              <span className="ml-1 text-xl text-muted-foreground">h</span>
            </span>
            {delta !== null && (
              <span className={cn("inline-flex items-center gap-0.5 text-sm font-medium tabular", delta >= 0 ? "text-success" : "text-danger")}>
                {delta >= 0 ? <ArrowUpRightIcon className="size-4" /> : <ArrowDownRightIcon className="size-4" />}
                {Math.abs(delta).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <Segmented label="Time range" value={range} onChange={setRange} options={RANGES} />
      </div>

      <div className="-mx-2 mt-2 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 16, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
                <stop offset="70%" stopColor="var(--primary)" stopOpacity={0.04} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical horizontal={false} stroke="var(--border)" strokeDasharray="4 6" />
            <XAxis
              dataKey="key"
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(key: string) => points.find((p) => p.key === key)?.tick ?? ""}
              height={28}
            />
            <YAxis
              orientation="right"
              axisLine={false}
              tickLine={false}
              width={44}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(value: number) => `${value}h`}
            />
            <Tooltip
              content={ChartTooltip}
              cursor={{ stroke: "var(--foreground)", strokeOpacity: 0.25, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="hours"
              stroke="var(--primary)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              activeDot={{ r: 5, fill: "var(--card)", stroke: "var(--primary)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {weeklyCapacityHours ? (
        <div className="mt-2">
          <div className="flex gap-1.5" aria-label="Weeks at team capacity">
            {weeks.map((w) => {
              const hit = w.seconds >= target;
              const inProgress = w.week === thisWeek;
              return (
                <span
                  key={w.week}
                  title={`Week of ${formatDay(w.week, { month: "short", day: "numeric" })}: ${toHours(w.seconds)}h of ${weeklyCapacityHours}h`}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    inProgress ? "bg-foreground/25" : hit ? "bg-success" : "bg-foreground/10",
                  )}
                />
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-4" /> Average per working day
              <span className="font-medium text-foreground tabular">{perDay}h</span>
            </span>
            <span className="flex items-center gap-4">
              <span className="inline-flex items-center gap-2">
                <span className="size-3 rounded-[4px] bg-primary" /> Hours logged
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-3 rounded-[4px] bg-success" /> Weeks at capacity
              </span>
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">
          Average per working day <span className="font-medium text-foreground tabular">{perDay}h</span>
        </div>
      )}
    </Panel>
  );
}
