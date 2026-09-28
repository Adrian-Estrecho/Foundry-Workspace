"use client";

import Link from "next/link";
import { ArrowDownLeftIcon, ArrowUpRightIcon, UsersIcon } from "lucide-react";
import { usePresence } from "@/components/presence/presence-provider";
import { EmptyState } from "@/components/shared/panel";
import { StatusChip, StatusDot } from "@/components/shared/status";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { formatClock, formatDuration } from "@/lib/dates";
import { liveStatus, STATUS_META, type LiveStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { TeamMember } from "./queries";

const ORDER: Record<LiveStatus, number> = { working: 0, on_break: 1, online: 2, offline: 3 };

/**
 * "Who's working now": the first active session up top, then every editor's
 * live status, task and session time. Status changes arrive via
 * <RealtimeRefresh>; Online/Offline via presence; timers tick locally.
 */
export function WhosWorking({ team, renderedAt }: { team: TeamMember[]; renderedAt: number }) {
  const now = useNow(renderedAt);
  const { onlineIds, ready } = usePresence();

  const members = team
    .map((m) => ({ ...m, status: liveStatus(m.workStatus, ready ? onlineIds.has(m.id) : m.recentlySeen) }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name));

  const featured = members.find((m) => m.status === "working" || m.status === "on_break");
  const working = members.filter((m) => m.status === "working").length;

  const elapsed = (m: (typeof members)[number]) => (m.clockInAt ? (now - new Date(m.clockInAt).getTime()) / 1000 : 0);

  return (
    <section className="flex flex-col rounded-xl border bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-base font-medium">Who&apos;s working</h2>
        <span className="text-sm text-muted-foreground tabular">
          {working} of {members.length} working
        </span>
      </header>

      {featured ? (
        <div className="mt-4 rounded-lg bg-surface p-4 ring-1 ring-border">
          <div className="flex items-center gap-3">
            <UserAvatar name={featured.name} src={featured.avatarUrl} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{featured.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {featured.taskTitle ?? "No task selected"}
                {featured.projectName && ` · ${featured.projectName}`}
              </p>
            </div>
            <StatusChip status={featured.status} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Session</p>
          <p className="font-heading text-3xl font-semibold tracking-tight tabular">{formatClock(elapsed(featured))}</p>
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-surface ring-1 ring-border">
          <EmptyState
            icon={UsersIcon}
            title="Nobody is working right now"
            description="Editors appear here as soon as they start working."
          />
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button asChild variant="secondary">
          <Link href="/attendance">
            <ArrowDownLeftIcon /> Live board
          </Link>
        </Button>
        <Button asChild>
          <Link href="/tasks">
            <ArrowUpRightIcon /> Assign task
          </Link>
        </Button>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-sm font-medium">Team</h3>
        <Link href="/editors" className="text-sm text-muted-foreground hover:text-foreground">
          View all
        </Link>
      </div>
      <ul className="mt-1 divide-y">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <span className="relative">
              <UserAvatar name={m.name} src={m.avatarUrl} className="size-9" />
              <StatusDot status={m.status} className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{m.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {m.status === "working" || m.status === "on_break"
                  ? (m.taskTitle ?? "No task selected")
                  : m.status === "online"
                    ? "Online, not working"
                    : "Offline"}
              </span>
            </span>
            {(m.status === "working" || m.status === "on_break") && m.clockInAt ? (
              <span className={cn("text-sm font-medium tabular", m.status === "working" ? "text-status-working" : "text-status-break")}>
                {formatDuration(elapsed(m))}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">{STATUS_META[m.status].label}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
