"use client";

import * as React from "react";
import { KeyRoundIcon, LockIcon, SearchIcon, UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { Segmented } from "@/components/shared/segmented";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { abilityNames, accessSummary, accessTitle } from "../labels";
import type { Person } from "../queries";
import { AccessDialog, TitleChip } from "./access-dialog";

type Filter = "all" | "admins" | "editors" | "onboarding";

const matches: Record<Filter, (p: Person) => boolean> = {
  all: () => true,
  admins: (p) => p.role !== "editor",
  editors: (p) => p.role === "editor" && p.status === "active",
  onboarding: (p) => p.status === "onboarding",
};

/** Everyone in the workspace with their access, and the Access button that changes it. */
export function PeopleTable({ people, viewerId }: { people: Person[]; viewerId: string }) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  // The key remounts the dialog, so it starts from the saved access each time.
  const [editing, setEditing] = React.useState<{ key: number; id: string } | null>(null);
  const [open, setOpen] = React.useState(false);

  const q = query.trim().toLowerCase();
  const visible = people.filter(
    (p) => matches[filter](p) && (!q || [p.name, p.email, accessTitle(p)].some((v) => v.toLowerCase().includes(q))),
  );
  const count = (f: Filter) => people.filter(matches[f]).length;
  const titles = [...new Set(people.flatMap((p) => (p.title ? [p.title] : [])))];
  const person = editing ? people.find((p) => p.id === editing.id) : undefined;

  const openAccess = (id: string) => {
    setEditing((current) => ({ key: (current?.key ?? 0) + 1, id }));
    setOpen(true);
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All ${count("all")}` },
            { value: "admins", label: `Admins ${count("admins")}` },
            { value: "editors", label: `Editors ${count("editors")}` },
            { value: "onboarding", label: `Onboarding ${count("onboarding")}` },
          ]}
        />
        <div className="relative w-full sm:ml-auto sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email or title"
            aria-label="Search people"
            className="rounded-full bg-surface pl-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {visible.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={q ? "No matches" : "Nobody here"}
            description={q ? "Try another name, email or title." : undefined}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Person
                </th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">
                  Access
                </th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">
                  Status
                </th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium xl:table-cell">
                  Joined
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((p) => {
                const self = p.id === viewerId;
                const ownerRow = p.role === "owner" && !self;
                const abilities = abilityNames(p);
                return (
                  <tr key={p.id} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar name={p.name} src={p.avatarUrl} className="size-9 shrink-0" />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-medium">{p.name}</span>
                            {self && <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10px] font-medium uppercase">You</span>}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                          {/* Phones: the access under the name. */}
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
                            <TitleChip label={accessTitle(p)} admin={p.role !== "editor"} />
                            <span className="text-xs text-muted-foreground">{accessSummary(p)}</span>
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="flex min-w-0 flex-col items-start gap-1">
                        <TitleChip label={accessTitle(p)} admin={p.role !== "editor"} />
                        {abilities.length > 0 && p.role === "editor" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default text-xs text-muted-foreground underline decoration-dotted underline-offset-2">
                                {accessSummary(p)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-64">
                              <ul className="grid gap-0.5">
                                {abilities.map((name) => (
                                  <li key={name}>{name}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">{accessSummary(p)}</span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                          p.status === "onboarding" ? "bg-primary/12 text-primary" : "bg-success/12 text-success",
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", p.status === "onboarding" ? "bg-primary" : "bg-success")} />
                        {p.status === "onboarding" ? "Onboarding" : "Active"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground tabular xl:table-cell">
                      {formatDay(p.joinedAt.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ownerRow ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <LockIcon className="size-3.5" /> Owner
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>The owner always has full access.</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-surface ring-1 ring-border"
                          onClick={() => openAccess(p.id)}
                          aria-label={self ? "Edit your title" : `Access for ${p.name}`}
                        >
                          <KeyRoundIcon /> {self ? "Title" : "Access"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && person && (
        <AccessDialog key={editing.key} person={person} viewerId={viewerId} titles={titles} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}
