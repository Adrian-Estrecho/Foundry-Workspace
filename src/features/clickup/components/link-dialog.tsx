"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, ChevronRightIcon, FolderIcon, ListIcon, Loader2Icon, Link2Icon } from "lucide-react";
import { FieldGroup, FormRow, NativeSelect, submitWith } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/features/statuses/components/status-chip";
import { TASK_STAGES } from "@/features/tasks/constants";
import { browseClickUp, getListSetup, linkPipeline } from "../actions";
import { CLICKUP_STATUS_TYPES, type ClickUpListNode, type ClickUpTree, type ListSetup } from "../types";

type Option = { id: string; name: string };

/** "Salon Dehuei Content Pipeline" → "Salon Dehuei": a starting point for the client's name. */
const clientGuess = (listName: string) => listName.replace(/\s*[—–-]?\s*(phase \d+\s*)?(content )?pipeline$/i, "").trim() || listName;

/**
 * Linking a List, in two steps: pick it from the ClickUp workspace, then say
 * which project it feeds, where syncing starts and each status's stage.
 */
export function LinkDialog({
  open,
  onOpenChange,
  projects,
  clients,
  firstLink,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: (Option & { clientName: string })[];
  clients: Option[];
  /** No List is linked yet: replacing the workspace's own statuses starts ticked. */
  firstLink: boolean;
}) {
  const [tree, setTree] = React.useState<ClickUpTree | null>(null);
  const [setup, setSetup] = React.useState<ListSetup | null>(null);
  const [opening, setOpening] = React.useState<string | null>(null);
  const [, startLoad] = React.useTransition();

  React.useEffect(() => {
    if (!open || tree) return;
    startLoad(async () => {
      const result = await browseClickUp();
      if (!result.ok) return void toast.error(result.error);
      setTree(result.data);
    });
  }, [open, tree]);

  const pick = (list: ClickUpListNode) => {
    setOpening(list.id);
    startLoad(async () => {
      const result = await getListSetup(list.id);
      setOpening(null);
      if (!result.ok) return void toast.error(result.error);
      setSetup(result.data);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) setSetup(null);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        {setup ? (
          <SetupForm
            setup={setup}
            projects={projects}
            clients={clients}
            firstLink={firstLink}
            onBack={() => setSetup(null)}
            onLinked={() => {
              setSetup(null);
              setTree(null);
              onOpenChange(false);
            }}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Link a ClickUp List</DialogTitle>
              <DialogDescription>Pick the pipeline whose tasks should come into ReEdit.</DialogDescription>
            </DialogHeader>
            <div className="-mx-2 max-h-[60vh] overflow-y-auto px-2">
              {tree ? <ListTree tree={tree} opening={opening} onPick={pick} /> : <TreeSkeleton />}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TreeSkeleton() {
  return (
    <div className="grid gap-2" aria-label="Loading your ClickUp Lists">
      <Skeleton className="h-4 w-32 rounded-md" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-10 rounded-lg" />
      ))}
    </div>
  );
}

function ListTree({ tree, opening, onPick }: { tree: ClickUpTree; opening: string | null; onPick: (list: ClickUpListNode) => void }) {
  const empty = tree.spaces.every((s) => s.lists.length === 0 && s.folders.every((f) => f.lists.length === 0));
  if (empty) return <p className="py-6 text-center text-sm text-muted-foreground">This ClickUp workspace has no Lists yet.</p>;

  const row = (list: ClickUpListNode) => (
    <li key={list.id}>
      <button
        type="button"
        disabled={Boolean(list.linkedTo) || opening !== null}
        onClick={() => onPick(list)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
      >
        <ListIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{list.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {list.linkedTo ? `Linked to ${list.linkedTo}` : list.taskCount !== null ? `${list.taskCount} tasks` : ""}
        </span>
        {opening === list.id ? (
          <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
    </li>
  );

  return (
    <div className="grid gap-5">
      {tree.spaces.map((space) => (
        <section key={space.id} className="grid gap-2">
          <h3 className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{space.name}</h3>
          {space.folders.map((folder) => (
            <div key={folder.id} className="grid gap-1">
              <p className="flex items-center gap-2 px-3 text-sm text-muted-foreground">
                <FolderIcon className="size-4" /> {folder.name}
              </p>
              <ul className="ml-4 grid gap-0.5 border-l pl-2">{folder.lists.map(row)}</ul>
            </div>
          ))}
          {space.lists.length > 0 && <ul className="grid gap-0.5">{space.lists.map(row)}</ul>}
        </section>
      ))}
    </div>
  );
}

function SetupForm({
  setup,
  projects,
  clients,
  firstLink,
  onBack,
  onLinked,
}: {
  setup: ListSetup;
  projects: (Option & { clientName: string })[];
  clients: Option[];
  firstLink: boolean;
  onBack: () => void;
  onLinked: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [project, setProject] = React.useState("new");
  const [client, setClient] = React.useState(clients.length ? "" : "new");

  const byClient = new Map<string, typeof projects>();
  for (const p of projects) byClient.set(p.clientName, [...(byClient.get(p.clientName) ?? []), p]);
  const defaultStart = (setup.statuses.find((s) => /ready to edit/.test(s.name)) ?? setup.statuses[0])?.name;

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await linkPipeline(formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      const { created, skipped } = result.data.counts;
      toast.success(`${setup.list.name} linked`, {
        description: `${created} ${created === 1 ? "task" : "tasks"} brought in${skipped ? `, ${skipped} left in ClickUp (not started yet or already finished)` : ""}.`,
        action: { label: "Open project", onClick: () => router.push(`/projects/${result.data.projectId}`) },
      });
      onLinked();
      router.refresh();
    });

  return (
    <form onSubmit={submitWith(submit)} className="grid gap-5">
      <input type="hidden" name="list_id" value={setup.list.id} />
      <DialogHeader>
        <DialogTitle className="text-xl">Link {setup.list.name}</DialogTitle>
        <DialogDescription>Its tasks come into a ReEdit project, with ClickUp&apos;s statuses.</DialogDescription>
      </DialogHeader>

      <div className="grid max-h-[60vh] grid-cols-1 gap-5 overflow-y-auto pr-1 sm:grid-cols-2">
        <FormRow label="ReEdit project" error={errors.project} className="sm:col-span-2">
          <NativeSelect name="project" value={project} onChange={(event) => setProject(event.target.value)}>
            <option value="new">New project</option>
            {[...byClient.entries()].map(([clientName, list]) => (
              <optgroup key={clientName} label={clientName}>
                {list.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
        </FormRow>

        {project === "new" && (
          <>
            <FormRow label="Project name" error={errors.project_name}>
              <Input name="project_name" defaultValue={setup.list.name} maxLength={120} aria-invalid={!!errors.project_name} />
            </FormRow>
            <FormRow label="Client" error={errors.client}>
              <NativeSelect name="client" value={client} onChange={(event) => setClient(event.target.value)} aria-invalid={!!errors.client}>
                <option value="" disabled>
                  Pick a client
                </option>
                <option value="new">New client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </FormRow>
            {client === "new" && (
              <FormRow label="Client name" error={errors.client_name} className="sm:col-span-2">
                <Input name="client_name" defaultValue={clientGuess(setup.list.name)} maxLength={120} aria-invalid={!!errors.client_name} />
              </FormRow>
            )}
          </>
        )}

        <FormRow
          label="Start syncing at"
          error={errors.start_status}
          hint="Tasks come into ReEdit when they reach this status or a later one. Earlier ones stay in ClickUp."
          className="sm:col-span-2"
        >
          <NativeSelect name="start_status" defaultValue={defaultStart}>
            {setup.statuses.map((status) => (
              <option key={status.name} value={status.name}>
                {status.label}
              </option>
            ))}
          </NativeSelect>
        </FormRow>

        <FieldGroup
          label="Stages"
          hint="The stage decides how a status behaves: editors move their work up to For Review, and only admins set Revisions and Done."
          className="sm:col-span-2"
        >
          <ul className="divide-y rounded-lg bg-surface ring-1 ring-border">
            {setup.statuses.map((status) => (
              <li key={status.name} className="grid grid-cols-[minmax(0,1fr)_9.5rem] items-center gap-3 py-1.5 pr-1.5 pl-3">
                <span className="flex min-w-0 items-center gap-2">
                  <StatusDot color={status.color} />
                  <span className="truncate text-sm font-medium">{status.label}</span>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {CLICKUP_STATUS_TYPES[status.type] ?? status.type}
                  </span>
                </span>
                <NativeSelect
                  name={`stage:${status.name}`}
                  defaultValue={status.stage}
                  disabled={status.fixed}
                  title={status.fixed ? "Already set up here. Change its stage in Edit statuses on the Tasks page." : undefined}
                  aria-label={`Stage for ${status.label}`}
                  className="h-8 rounded-lg"
                >
                  {TASK_STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </NativeSelect>
              </li>
            ))}
          </ul>
        </FieldGroup>

        {setup.otherStatuses.length > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-surface p-4 ring-1 ring-border sm:col-span-2">
            <input type="checkbox" name="replace" defaultChecked={firstLink} className="mt-0.5 size-4 shrink-0 accent-primary" />
            <span>
              <span className="block text-sm font-medium">Replace ReEdit&apos;s own statuses</span>
              <span className="block text-xs text-muted-foreground">
                Removes {setup.otherStatuses.join(", ")}. Tasks in them move to the first ClickUp status of the same stage.
              </span>
            </span>
          </label>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onBack} disabled={pending}>
          <ArrowLeftIcon /> Back
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <Link2Icon />}
          {pending ? "Importing…" : "Link and import"}
        </Button>
      </DialogFooter>
    </form>
  );
}
