"use client";

import * as React from "react";
import Link from "next/link";
import { SquareIcon, UsersIcon } from "lucide-react";
import { usePresence } from "@/components/presence/presence-provider";
import { EmptyState } from "@/components/shared/panel";
import { StatusChip, StatusDot } from "@/components/shared/status";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { formatDuration, formatTime, formatTimeOfDay, minutesNow, timeAgo, toHours, toMinutes } from "@/lib/dates";
import { liveStatus, STATUS_META, type LiveStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { BoardEditor } from "../queries";
import { EndShiftDialog } from "./end-shift-dialog";

const ORDER: Record<LiveStatus, number> = { working: 0, on_break: 1, online: 2, offline: 3 };

/**
 * Everyone's status right now: working (and on what), on a break, online,
 * or offline, with today's and this week's hours. Status changes arrive over
 * Realtime; Online/Offline from presence; timers tick locally.
 */
export function LiveBoard({ editors, renderedAt }: { editors: BoardEditor[]; renderedAt: number }) {
  const now = useNow(renderedAt);
  const { onlineIds, ready } = usePresence();
  const [ending, setEnding] = React.useState<BoardEditor | null>(null);
  const since = Math.max(0, (now - renderedAt) / 1000);

  const members = editors
    .map((e) => ({
      ...e,
      live: liveStatus(e.workStatus, ready ? onlineIds.has(e.id) : e.recentlySeen),
      worked: e.workedToday + (e.workStatus === "working" ? since : 0),
      breaks: e.breakToday + (e.workStatus === "on_break" ? since : 0),
      week: e.weekSeconds + (e.workStatus === "working" ? since : 0),
    }))
    .sort((a, b) => ORDER[a.live] - ORDER[b.live] || a.name.localeCompare(b.name));

  const count = (status: LiveStatus) => members.filter((m) => m.live === status).length;
  const teamToday = members.reduce((sum, m) => sum + m.worked, 0);

  if (members.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState icon={UsersIcon} title="No editors yet" description="Approved editors show up here with their live status." />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(["working", "on_break", "online", "offline"] as const).map((status) => (
          <div key={status} className="rounded-xl border bg-card p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatusDot status={status} className="size-2" />
              {STATUS_META[status].label}
            </p>
            <p className="mt-1.5 font-heading text-2xl font-semibold tabular">{count(status)}</p>
          </div>
        ))}
        <div className="col-span-2 rounded-xl border bg-card p-4 sm:col-span-1">
          <p className="text-sm text-muted-foreground">Team hours today</p>
          <p className="mt-1.5 font-heading text-2xl font-semibold tabular">{formatDuration(teamToday).replace("<1m", "0h")}</p>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {members.map((m) => {
          const active = m.workStatus !== "off";
          const late = m.scheduledToday && !m.firstInToday && !active && minutesNow(m.timeZone, now) > toMinutes(m.shiftStart);
          const weekTarget = m.weeklyHours ? m.weeklyHours * 3600 : null;
          return (
            <li key={m.id} className="flex flex-col rounded-xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="relative">
                  <UserAvatar name={m.name} src={m.avatarUrl} className="size-10" />
                  <StatusDot status={m.live} className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-card" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/editors/${m.id}`} className="block truncate font-medium hover:underline">
                    {m.name}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">
                    {active ? (
                      m.task ? (
                        <Link href={`/tasks/${m.task.id}`} className="hover:text-foreground">
                          {m.task.title}
                          {m.task.projectName && ` · ${m.task.projectName}`}
                        </Link>
                      ) : (
                        "No specific task"
                      )
                    ) : m.live === "online" ? (
                      "Online, not working"
                    ) : m.lastSeenAt ? (
                      `Last seen ${timeAgo(m.lastSeenAt, now)}`
                    ) : (
                      "Not seen yet"
                    )}
                  </p>
                </div>
                <StatusChip status={m.live} />
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Today</dt>
                  <dd className={cn("font-medium tabular", m.workStatus === "working" && "text-status-working")}>
                    {formatDuration(m.worked).replace("<1m", "0h")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Breaks</dt>
                  <dd className={cn("font-medium tabular", m.workStatus === "on_break" && "text-status-break")}>
                    {m.breaks >= 60 ? formatDuration(m.breaks) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">This week</dt>
                  <dd className="font-medium tabular">
                    {toHours(m.week)}h{weekTarget ? <span className="font-normal text-muted-foreground"> / {m.weeklyHours}h</span> : null}
                  </dd>
                </div>
              </dl>
              {weekTarget && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (m.week / weekTarget) * 100)}%` }} />
                </div>
              )}

              <div className="mt-4 flex min-h-8 items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                <span className={cn("min-w-0 truncate", late && "font-medium text-danger")}>
                  {active && m.clockInAt
                    ? `Started ${formatTime(m.clockInAt, m.timeZone, true)}`
                    : m.firstInToday
                      ? `Worked today from ${formatTime(m.firstInToday, m.timeZone, true)}`
                      : !m.scheduledToday
                        ? "Not scheduled today"
                        : late
                          ? `Not started · due ${formatTimeOfDay(m.shiftStart)} their time`
                          : `Starts ${formatTimeOfDay(m.shiftStart)} their time`}
                </span>
                {active && (
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setEnding(m)}>
                    <SquareIcon className="fill-current" /> End shift
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <EndShiftDialog editor={ending} onOpenChange={(open) => !open && setEnding(null)} />
    </>
  );
}

