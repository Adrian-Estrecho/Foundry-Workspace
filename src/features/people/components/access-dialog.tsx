"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2Icon,
  CheckIcon,
  InfoIcon,
  ListChecksIcon,
  Loader2Icon,
  LockIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { memberLabel } from "@/features/workspaces/constants";
import {
  ACCESS_PRESETS,
  ADMIN_ONLY,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  PERMISSIONS,
  TITLE_MAX,
  type Permission,
  type PermissionGroup,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { updateAccess } from "../actions";
import { accessTitle } from "../labels";
import type { Person } from "../queries";

const GROUP_ICONS: Record<PermissionGroup, LucideIcon> = {
  work: ListChecksIcon,
  people: UsersIcon,
  workspace: Building2Icon,
  company: MegaphoneIcon,
};

type Level = "editor" | "admin";

const sameSet = (a: ReadonlySet<string>, b: readonly string[]) => a.size === b.length && b.every((key) => a.has(key));

/**
 * People → Access: the person's access title, whether they're an admin, and
 * (for editors) which admin abilities they have, grouped by area. Presets
 * fill in a common set; nothing is saved until "Save access".
 */
export function AccessDialog({
  person,
  viewerId,
  titles,
  open,
  onOpenChange,
}: {
  person: Person;
  viewerId: string;
  /** Titles already used in the workspace, offered as suggestions. */
  titles: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [pending, startTransition] = React.useTransition();
  const initialLevel: Level = person.role === "editor" ? "editor" : "admin";
  const [title, setTitle] = React.useState(person.title ?? "");
  const [level, setLevel] = React.useState<Level>(initialLevel);
  const [granted, setGranted] = React.useState<Set<Permission>>(() => new Set(person.permissions));

  const self = person.id === viewerId;
  const owner = person.role === "owner";
  // Only the title changes on your own row and on the owner's.
  const locked = self || owner;
  const canBeAdmin = person.status === "active";
  const isAdmin = level === "admin";
  const firstName = person.name.split(" ")[0] || person.name;

  const dirty = title.trim() !== (person.title ?? "") || level !== initialLevel || !sameSet(granted, person.permissions);
  const count = isAdmin ? PERMISSION_KEYS.length : granted.size;
  const activePreset = !isAdmin ? ACCESS_PRESETS.find((preset) => sameSet(granted, preset.permissions)) : undefined;
  const suggestions = [...new Set([...ACCESS_PRESETS.map((p) => p.title), ...titles])].sort((a, b) => a.localeCompare(b));

  const toggle = (key: Permission, on: boolean) =>
    setGranted((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const toggleGroup = (keys: Permission[], on: boolean) =>
    setGranted((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });

  const applyPreset = (preset: (typeof ACCESS_PRESETS)[number]) => {
    setLevel("editor");
    setGranted(new Set(preset.permissions));
    // A preset names the access too, unless they typed a title of their own.
    const current = title.trim();
    if (!current || ACCESS_PRESETS.some((p) => p.title === current)) setTitle(preset.title);
  };

  const save = () =>
    startTransition(async () => {
      const result = await updateAccess({ userId: person.id, role: level, title, permissions: [...granted] });
      if (!result.ok) return void toast.error(result.error);
      toast.success(self ? "Your title is saved" : `${firstName}'s access is saved`, {
        description: locked ? undefined : "It applies the next time they open a page.",
      });
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent
        ref={contentRef}
        // Focus the dialog, not the title field: auto-focus would select its text.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 outline-none sm:max-w-3xl"
      >
        <DialogHeader className="flex-row items-center gap-3.5 border-b px-6 py-5 pr-14 text-left">
          <UserAvatar name={person.name} src={person.avatarUrl} className="size-11" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-lg">Access for {person.name}</DialogTitle>
            <DialogDescription className="truncate">
              {person.email}
              {person.status === "onboarding" && " · Onboarding"}
            </DialogDescription>
          </div>
          <TitleChip label={accessTitle(person)} admin={person.role !== "editor"} className="hidden sm:inline-flex" />
        </DialogHeader>

        <form
          id="access-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (dirty && !pending) save();
          }}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div className="grid gap-7 px-6 py-6">
            <Section title="Access title" description="Shown next to their name in People and on their profile.">
              <div className="grid max-w-md gap-1.5">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={TITLE_MAX}
                  list="access-title-suggestions"
                  placeholder={memberLabel(level === "admin" && !owner ? "admin" : person.role, person.status)}
                  aria-label="Access title"
                  autoComplete="off"
                />
                <datalist id="access-title-suggestions">
                  {suggestions.map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
                <span className="text-xs text-muted-foreground">
                  For example Operational control or Senior editor. Leave it empty to show the role.
                </span>
              </div>
            </Section>

            <Section title="Access level" description="Admins can do everything. Editors work on their own tasks, plus the abilities you give them.">
              {locked ? (
                <Note icon={LockIcon}>
                  {owner
                    ? "The owner always has full access. Only the title can change."
                    : "You can't change your own access. Another admin or the owner can."}
                </Note>
              ) : (
                <div role="radiogroup" aria-label="Access level" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <LevelOption
                    selected={!isAdmin}
                    onSelect={() => setLevel("editor")}
                    icon={UserRoundIcon}
                    title="Editor"
                    description="Their own tasks and time, plus the abilities ticked below."
                  />
                  <LevelOption
                    selected={isAdmin}
                    onSelect={() => setLevel("admin")}
                    icon={ShieldCheckIcon}
                    title="Admin"
                    description="Everything, including People and access, ClickUp and payment details."
                    disabled={!canBeAdmin}
                    disabledReason="Approve them first: people still onboarding can't be admins."
                  />
                </div>
              )}
            </Section>

            <section aria-labelledby="abilities-heading" className="grid gap-4">
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <h3 id="abilities-heading" className="text-sm font-medium">
                    Abilities
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Admin-only actions they can take. Anything unticked stays with the admins.</p>
                </div>
                <p className="text-xs text-muted-foreground tabular">
                  <span className="font-medium text-foreground">{count}</span> of {PERMISSION_KEYS.length} selected
                </p>
              </div>

              {!locked && !isAdmin && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs text-muted-foreground">Start from</span>
                  {ACCESS_PRESETS.map((preset) => {
                    const on = activePreset === preset;
                    return (
                      <button
                        key={preset.title}
                        type="button"
                        aria-pressed={on}
                        onClick={() => applyPreset(preset)}
                        className={cn(
                          "inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-medium ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          on
                            ? "bg-primary/12 text-primary ring-primary/30"
                            : "bg-surface text-muted-foreground ring-border hover:text-foreground",
                        )}
                      >
                        {on && <CheckIcon className="size-3" />}
                        {preset.title}
                      </button>
                    );
                  })}
                </div>
              )}

              {isAdmin && !locked && <Note icon={ShieldCheckIcon}>Admins have every ability. Choose Editor to pick them one by one.</Note>}
              {!isAdmin && person.status === "onboarding" && (
                <Note icon={InfoIcon}>{firstName} is still onboarding. What you tick here starts working once you approve them.</Note>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {PERMISSION_GROUPS.map((group) => (
                  <GroupCard
                    key={group.key}
                    group={group}
                    granted={granted}
                    all={isAdmin || owner}
                    disabled={locked || isAdmin}
                    onToggle={toggle}
                    onToggleGroup={toggleGroup}
                  />
                ))}
              </div>
            </section>

            <p className="flex items-start gap-2.5 rounded-lg bg-muted/60 px-3.5 py-3 text-xs text-muted-foreground">
              <LockIcon className="mt-px size-3.5 shrink-0" />
              <span>
                Always admin-only: {ADMIN_ONLY.slice(0, -1).join(", ")} and {ADMIN_ONLY.at(-1)}.
              </span>
            </p>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-6 py-4">
          <p className="mr-auto text-sm text-muted-foreground">
            {isAdmin ? (
              "Full access"
            ) : (
              <>
                <span className="font-medium text-foreground tabular">{count}</span> {count === 1 ? "ability" : "abilities"} beyond an editor
              </>
            )}
          </p>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="access-form" disabled={!dirty || pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
            Save access
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Note({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-lg bg-surface px-3.5 py-3 text-sm ring-1 ring-border">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span>{children}</span>
    </p>
  );
}

export function TitleChip({ label, admin, className }: { label: string; admin: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium",
        admin ? "bg-primary/12 text-primary" : "bg-surface text-foreground ring-1 ring-border",
        className,
      )}
    >
      {label}
    </span>
  );
}

function LevelOption({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
  disabled = false,
  disabledReason,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      title={disabled ? disabledReason : undefined}
      className={cn(
        "flex items-start gap-3 rounded-xl p-4 text-left ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "bg-primary/8 ring-primary/40" : "bg-surface ring-border hover:bg-accent/50",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          selected ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border",
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{title}</span>
          <span
            aria-hidden="true"
            className={cn(
              "grid size-4 shrink-0 place-items-center rounded-full ring-1",
              selected ? "bg-primary ring-primary" : "ring-border",
            )}
          >
            {selected && <span className="size-1.5 rounded-full bg-primary-foreground" />}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{disabled && disabledReason ? disabledReason : description}</span>
      </span>
    </button>
  );
}

function GroupCard({
  group,
  granted,
  all,
  disabled,
  onToggle,
  onToggleGroup,
}: {
  group: (typeof PERMISSION_GROUPS)[number];
  granted: ReadonlySet<Permission>;
  /** Shown as all ticked (admins and the owner). */
  all: boolean;
  disabled: boolean;
  onToggle: (key: Permission, on: boolean) => void;
  onToggleGroup: (keys: Permission[], on: boolean) => void;
}) {
  const Icon = GROUP_ICONS[group.key];
  const items = PERMISSIONS.filter((p) => p.group === group.key);
  const keys = items.map((p) => p.key);
  const on = all ? keys.length : keys.filter((key) => granted.has(key)).length;
  const full = on === keys.length;

  return (
    <fieldset disabled={disabled} className="min-w-0 rounded-xl border bg-card">
      <legend className="sr-only">{group.label}</legend>
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" aria-hidden="true">
            {group.label}
          </p>
          <p className="truncate text-xs text-muted-foreground">{group.description}</p>
        </div>
        <span className="text-xs text-muted-foreground tabular">
          {on}/{keys.length}
          <span className="sr-only"> selected</span>
        </span>
        {!disabled && (
          <Button type="button" variant="ghost" size="xs" onClick={() => onToggleGroup(keys, !full)} aria-label={`${full ? "Clear" : "Select all"}: ${group.label}`}>
            {full ? "Clear" : "Select all"}
          </Button>
        )}
      </div>
      <div className="divide-y">
        {items.map((permission) => {
          const checked = all || granted.has(permission.key);
          return (
            <label
              key={permission.key}
              className={cn(
                "flex gap-3 px-4 py-3 transition-colors",
                disabled ? "cursor-default opacity-70" : "cursor-pointer hover:bg-accent/40",
                checked && !disabled && "bg-primary/[0.04]",
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => onToggle(permission.key, value === true)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{permission.label}</span>
                <span className="block text-xs text-muted-foreground">{permission.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
