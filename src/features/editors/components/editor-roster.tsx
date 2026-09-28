"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LinkIcon, MailIcon, SearchIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import { usePresence } from "@/components/presence/presence-provider";
import { EmptyState } from "@/components/shared/panel";
import { Segmented } from "@/components/shared/segmented";
import { StatusChip, StatusDot } from "@/components/shared/status";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toHours } from "@/lib/dates";
import { liveStatus } from "@/lib/status";
import { localTime, zoneCity } from "@/lib/time-zones";
import { cn } from "@/lib/utils";
import type { RosterEditor } from "../queries";
import { InviteEditorDialog } from "./invite-editor-dialog";

type Filter = "active" | "onboarding" | "inactive" | "all";

const matches: Record<Filter, (e: RosterEditor) => boolean> = {
  active: (e) => e.isActive,
  onboarding: (e) => e.isActive && e.onboarding !== null,
  inactive: (e) => !e.isActive,
  all: () => true,
};

export function EditorRoster({
  editors,
  renderedAt,
  timeZones,
  defaultTimeZone,
}: {
  editors: RosterEditor[];
  renderedAt: number;
  timeZones: string[];
  defaultTimeZone: string;
}) {
  const { onlineIds, ready } = usePresence();
  const [filter, setFilter] = React.useState<Filter>("active");
  const [query, setQuery] = React.useState("");
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const q = query.trim().toLowerCase();
  const visible = editors.filter(
    (e) =>
      matches[filter](e) &&
      (!q || [e.name, e.email, e.timezone, ...e.software, ...e.specialties].some((v) => v.toLowerCase().includes(q))),
  );
  const count = (f: Filter) => editors.filter(matches[f]).length;

  const copyApplyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/apply`);
      toast.success("Application form link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "active", label: `Active ${count("active")}` },
            { value: "onboarding", label: `Onboarding ${count("onboarding")}` },
            { value: "inactive", label: `Inactive ${count("inactive")}` },
            { value: "all", label: "All" },
          ]}
        />
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, skill, timezone"
            aria-label="Search editors"
            className="rounded-full bg-surface pl-9"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={copyApplyLink} className="bg-surface ring-1 ring-border">
            <LinkIcon /> Application form link
          </Button>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlusIcon /> Invite editor
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {visible.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={q ? "No matches" : filter === "onboarding" ? "Nobody is onboarding" : "No editors here"}
            description={q ? "Try another name or skill." : undefined}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Editor</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Status</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium xl:table-cell">Skills</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">Rate</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">Local time</th>
                <th scope="col" className="px-4 py-2.5 font-medium">This week</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((editor) => {
                const status = liveStatus(editor.workStatus, ready ? onlineIds.has(editor.id) : editor.recentlySeen);
                const hours = toHours(editor.secondsThisWeek);
                const target = editor.weeklyHours ?? 0;
                return (
                  <tr key={editor.id} className="relative transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="relative shrink-0">
                          <UserAvatar name={editor.name} src={editor.avatarUrl} className="size-9" />
                          {editor.isActive && (
                            <StatusDot status={status} className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <Link
                            href={`/editors/${editor.id}`}
                            className="block truncate font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                          >
                            {editor.name}
                          </Link>
                          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <span className="truncate">{editor.email}</span>
                            {editor.invitePending && (
                              <span className="inline-flex items-center gap-1 text-warning">
                                <MailIcon className="size-3" /> Invite pending
                              </span>
                            )}
                          </span>
                          {editor.onboarding && (
                            <span className="mt-1 flex max-w-44 items-center gap-2 text-xs text-muted-foreground">
                              <span className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
                                <span
                                  className="block h-full rounded-full bg-primary"
                                  style={{ width: `${(editor.onboarding.done / Math.max(1, editor.onboarding.total)) * 100}%` }}
                                />
                              </span>
                              <span className="tabular">
                                Onboarding {editor.onboarding.done}/{editor.onboarding.total}
                              </span>
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {editor.isActive ? (
                        <StatusChip status={status} />
                      ) : (
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Inactive</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 xl:table-cell">
                      <div className="flex max-w-72 flex-wrap gap-1">
                        {[...editor.software.slice(0, 2), ...editor.specialties.slice(0, 2)].map((skill) => (
                          <span key={skill} className="rounded-full bg-surface px-2 py-0.5 text-xs ring-1 ring-border">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 tabular lg:table-cell">
                      {editor.hourlyRate !== null ? `$${editor.hourlyRate}/h` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span className="block tabular">{localTime(editor.timezone, renderedAt)}</span>
                      <span className="block text-xs text-muted-foreground">{zoneCity(editor.timezone)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block tabular">
                        {hours}h{target > 0 && <span className="text-muted-foreground"> / {target}h</span>}
                      </span>
                      {target > 0 && (
                        <span className="mt-1 block h-1 w-20 overflow-hidden rounded-full bg-foreground/10">
                          <span
                            className={cn("block h-full rounded-full", hours >= target ? "bg-success" : "bg-primary")}
                            style={{ width: `${Math.min(100, (hours / target) * 100)}%` }}
                          />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <InviteEditorDialog open={inviteOpen} onOpenChange={setInviteOpen} timeZones={timeZones} defaultTimeZone={defaultTimeZone} />
    </>
  );
}
