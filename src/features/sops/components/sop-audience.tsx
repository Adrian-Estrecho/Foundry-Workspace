"use client";

import * as React from "react";
import { CheckIcon, SearchIcon } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AUDIENCE_GROUPS, audienceSummary, canSee, type Audience, type AudienceGroup, type Reader } from "../audience";

/**
 * Who can see an SOP. "Admins & managers" and "Editors" are listed apart,
 * each with a switch for the whole group (people who join it later too) and
 * a box per person. People who write SOPs are ticked for good: they see
 * every SOP.
 */
export function AudienceDialog({
  open,
  onOpenChange,
  audience,
  readers,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audience: Audience;
  readers: Reader[];
  onApply: (audience: Audience) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* Mounted while open, so it starts from the saved choice each time. */}
        <Picker
          audience={audience}
          readers={readers}
          onCancel={() => onOpenChange(false)}
          onApply={(next) => {
            onApply(next);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function Picker({
  audience,
  readers,
  onCancel,
  onApply,
}: {
  audience: Audience;
  readers: Reader[];
  onCancel: () => void;
  onApply: (audience: Audience) => void;
}) {
  const [draft, setDraft] = React.useState(audience);
  const [query, setQuery] = React.useState("");
  const search = query.trim().toLowerCase();
  const groupOfId = (id: string) => readers.find((reader) => reader.id === id)?.group;

  const setGroup = (group: AudienceGroup, on: boolean) =>
    setDraft((current) => ({
      ...current,
      [group]: on,
      // The switch covers them now (or, turned off, takes everyone in the group away).
      people: current.people.filter((id) => groupOfId(id) !== group),
    }));

  const setPerson = (reader: Reader, on: boolean) =>
    setDraft((current) => {
      if (on) return { ...current, people: [...current.people, reader.id] };
      if (!current[reader.group]) return { ...current, people: current.people.filter((id) => id !== reader.id) };
      // One person out of a whole group: everyone else in it, by name.
      const rest = readers.filter((other) => other.group === reader.group && !other.seesAll && other.id !== reader.id).map((other) => other.id);
      return { ...current, [reader.group]: false, people: [...new Set([...current.people, ...rest])] };
    });

  const apply = () =>
    onApply({
      ...draft,
      // Keep only people the groups don't cover already.
      people: draft.people.filter((id) => readers.some((reader) => reader.id === id && !reader.seesAll && !draft[reader.group])),
    });

  return (
    <>
      <DialogHeader className="border-b px-6 py-5 pr-14 text-left">
        <DialogTitle>Who can see this SOP</DialogTitle>
        <DialogDescription>Choose a whole group, or people one by one. People who write SOPs always see every SOP.</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-6 px-6 py-5">
          {readers.length > 8 && (
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find someone" className="pl-9" aria-label="Find someone" />
            </div>
          )}
          {(["admins", "editors"] as const).map((group) => {
            const members = readers.filter((reader) => reader.group === group);
            const shown = members.filter((reader) => !search || `${reader.name} ${reader.title}`.toLowerCase().includes(search));
            const seeing = members.filter((reader) => canSee(draft, reader)).length;
            const { label, description, empty } = AUDIENCE_GROUPS[group];
            return (
              <section key={group} aria-labelledby={`audience-${group}`} className="grid gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 id={`audience-${group}`} className="text-sm font-medium">
                      {label}{" "}
                      <span className="font-normal text-muted-foreground tabular">
                        · {seeing} of {members.length}
                      </span>
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                  </div>
                  <label className="flex shrink-0 items-center gap-2 pt-0.5 text-xs font-medium">
                    Everyone
                    <Switch checked={draft[group]} onCheckedChange={(on) => setGroup(group, on)} aria-label={`Everyone in ${label}`} />
                  </label>
                </div>
                {draft[group] && members.length > 0 && (
                  <p className="text-xs text-muted-foreground">Anyone who joins {label.toLowerCase()} later can see it too.</p>
                )}
                {shown.length === 0 ? (
                  <p className="rounded-lg bg-surface px-3 py-2.5 text-xs text-muted-foreground ring-1 ring-border">
                    {members.length ? "Nobody here matches." : empty}
                  </p>
                ) : (
                  <ul className="grid grid-cols-1 gap-0.5">
                    {shown.map((reader) => (
                      <li key={reader.id}>
                        <label className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50 has-disabled:hover:bg-transparent">
                          <UserAvatar name={reader.name} src={reader.avatarUrl} className="size-8" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{reader.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {reader.title}
                              {reader.onboarding && !/onboarding/i.test(reader.title) && " · onboarding"}
                              {reader.seesAll && " · writes SOPs, sees every one"}
                            </span>
                          </span>
                          <Checkbox
                            checked={canSee(draft, reader)}
                            disabled={reader.seesAll}
                            onCheckedChange={(checked) => setPerson(reader, checked === true)}
                            aria-label={`${reader.name} can see it`}
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-6 py-4">
        <p className="mr-auto min-w-0 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{audienceSummary(draft, readers)}</span>
        </p>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={apply}>
          <CheckIcon /> Done
        </Button>
      </div>
    </>
  );
}
