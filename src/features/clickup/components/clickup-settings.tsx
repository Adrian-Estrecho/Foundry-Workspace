"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  KeyRoundIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SparklesIcon,
  Unlink2Icon,
  UnplugIcon,
} from "lucide-react";
import { NativeSelect } from "@/components/shared/form";
import { EmptyState, Panel } from "@/components/shared/panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusChip } from "@/features/statuses/components/status-chip";
import { StatusManagerDialog } from "@/features/statuses/components/status-manager";
import { taskStageLabel } from "@/features/tasks/constants";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  confirmClickUpStatuses,
  disconnectClickUp,
  dismissClickUpError,
  setPipelineStart,
  syncPipelineNow,
  unlinkPipeline,
} from "../actions";
import type { ClickUpPage, PipelineRow, StatusLink } from "../queries";
import { statusLabel } from "../types";
import { ClickUpMark } from "./clickup-mark";
import { ConnectForm } from "./connect-form";
import { LinkDialog } from "./link-dialog";

/** The ClickUp page once connected: pipelines, the connection and how statuses line up. */
export function ClickUpSettings({ data, renderedAt }: { data: ClickUpPage & { connection: NonNullable<ClickUpPage["connection"]> }; renderedAt: number }) {
  const [linking, setLinking] = React.useState(false);

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
      <div className="grid grid-cols-1 gap-5 xl:col-span-2">
        {data.connection.lastError && (
          <ErrorNotice message={data.connection.lastError} at={data.connection.lastErrorAt} renderedAt={renderedAt} />
        )}
        <Panel
          title="Pipelines"
          description="ClickUp Lists whose tasks come into projects here."
          action={
            data.pipelines.length > 0 && (
              <Button size="sm" onClick={() => setLinking(true)}>
                <PlusIcon /> Link a List
              </Button>
            )
          }
        >
          {data.pipelines.length === 0 ? (
            <EmptyState
              icon={ClickUpMark}
              title="No pipelines yet"
              description="Link a ClickUp List to bring its tasks into a project, with ClickUp's statuses."
              action={
                <Button onClick={() => setLinking(true)}>
                  <PlusIcon /> Link a List
                </Button>
              }
            />
          ) : (
            <ul className="divide-y rounded-lg bg-surface ring-1 ring-border">
              {data.pipelines.map((pipeline) => (
                <PipelineItem key={pipeline.id} pipeline={pipeline} renderedAt={renderedAt} />
              ))}
            </ul>
          )}
        </Panel>
        <StatusLinks links={data.links} />
      </div>

      <ConnectionPanel data={data} renderedAt={renderedAt} />

      <LinkDialog
        open={linking}
        onOpenChange={setLinking}
        projects={data.projects}
        clients={data.clients}
        firstLink={data.pipelines.length === 0}
      />
    </div>
  );
}

function ErrorNotice({ message, at, renderedAt }: { message: string; at: string | null; renderedAt: number }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <div className="flex items-start gap-3 rounded-xl bg-danger/8 p-4 ring-1 ring-danger/25">
      <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-danger" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-danger">Something didn&apos;t sync{at && ` · ${timeAgo(at, renderedAt)}`}</p>
        <p className="mt-1 break-words">{message}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await dismissClickUpError();
            router.refresh();
          })
        }
      >
        Dismiss
      </Button>
    </div>
  );
}

function PipelineItem({ pipeline, renderedAt }: { pipeline: PipelineRow; renderedAt: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"sync" | "start" | null>(null);
  const [unlinking, setUnlinking] = React.useState(false);

  const summary = (counts: { created: number; updated: number; removed: number }) =>
    [counts.created && `${counts.created} new`, counts.updated && `${counts.updated} updated`, counts.removed && `${counts.removed} removed`]
      .filter(Boolean)
      .join(", ") || "Everything was already up to date.";

  const sync = async () => {
    setBusy("sync");
    const result = await syncPipelineNow(pipeline.id);
    setBusy(null);
    if (!result.ok) return void toast.error(result.error);
    toast.success(`${pipeline.listName} synced`, { description: summary(result.data) });
    router.refresh();
  };

  const changeStart = async (start: string) => {
    setBusy("start");
    const result = await setPipelineStart(pipeline.id, start);
    setBusy(null);
    if (!result.ok) return void toast.error(result.error);
    toast.success(`Syncing now starts at ${statusLabel(start)}`, { description: summary(result.data) });
    router.refresh();
  };

  return (
    <li className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-medium">
          <ClickUpMark className="text-muted-foreground" />
          <span className="truncate">{pipeline.listName}</span>
          <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
          {pipeline.project ? (
            <Link href={`/projects/${pipeline.project.id}`} className="truncate hover:text-primary">
              {pipeline.project.name}
            </Link>
          ) : (
            <span className="text-muted-foreground">Project removed</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {pipeline.tasks} {pipeline.tasks === 1 ? "task" : "tasks"}
          {pipeline.lastSyncedAt && ` · last full sync ${timeAgo(pipeline.lastSyncedAt, renderedAt)}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Starts at
          <NativeSelect
            value={pipeline.startStatus}
            disabled={busy !== null}
            onChange={(event) => void changeStart(event.target.value)}
            className="h-8 w-44 rounded-lg text-foreground"
          >
            {pipeline.statuses.map((status) => (
              <option key={status.name} value={status.name}>
                {statusLabel(status.name)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button variant="ghost" size="icon-sm" onClick={sync} disabled={busy !== null} aria-label={`Sync ${pipeline.listName} now`} title="Sync now">
          <RefreshCwIcon className={cn(busy && "animate-spin")} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-danger"
          onClick={() => setUnlinking(true)}
          disabled={busy !== null}
          aria-label={`Unlink ${pipeline.listName}`}
          title="Unlink"
        >
          <Unlink2Icon />
        </Button>
      </div>
      <UnlinkDialog pipeline={pipeline} open={unlinking} onOpenChange={setUnlinking} />
    </li>
  );
}

function UnlinkDialog({ pipeline, open, onOpenChange }: { pipeline: PipelineRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const unlink = () =>
    startTransition(async () => {
      const result = await unlinkPipeline(pipeline.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${pipeline.listName} unlinked`);
      onOpenChange(false);
      router.refresh();
    });

  return (
    <AlertDialog open={open} onOpenChange={(value) => !pending && onOpenChange(value)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop syncing {pipeline.listName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its {pipeline.tasks === 1 ? "task stays" : `${pipeline.tasks} tasks stay`} in {pipeline.project?.name ?? "the project"} as
            ordinary ReEdit tasks, and nothing changes in ClickUp. You can link the List again later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              unlink();
            }}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Unlink
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StatusLinks({ links }: { links: StatusLink[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [editing, setEditing] = React.useState(false);
  const fresh = links.filter((l) => l.needsReview);
  if (links.length === 0) return null;

  return (
    <Panel
      title="Statuses"
      description="Each ClickUp status and the status it is here. Moving a synced task here moves it in ClickUp too."
      action={
        <Button size="sm" variant="secondary" className="shrink-0 bg-surface-strong ring-1 ring-border" onClick={() => setEditing(true)}>
          <PencilIcon /> Edit statuses
        </Button>
      }
    >
      <StatusManagerDialog
        kind="task"
        open={editing}
        onOpenChange={(open) => {
          setEditing(open);
          if (!open) router.refresh();
        }}
      />
      {fresh.length > 0 && (
        <div className="mb-4 flex flex-wrap items-start gap-3 rounded-lg bg-warning/10 p-4 ring-1 ring-warning/25">
          <SparklesIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="min-w-0 flex-1 basis-60 text-sm">
            ClickUp got {fresh.length === 1 ? "a new status" : `${fresh.length} new statuses`}, added here with a guessed stage:{" "}
            {fresh.map((l) => `${l.status.name} (${taskStageLabel(l.status.stage)})`).join(", ")}. If one is wrong, change it
            in Edit statuses.
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await confirmClickUpStatuses();
                if (!result.ok) return void toast.error(result.error);
                router.refresh();
              })
            }
          >
            Looks right
          </Button>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.clickupStatus} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground">{link.clickupStatus}</span>
            <span className="flex min-w-0 items-center gap-2">
              <StatusChip status={link.status} />
              <span className="hidden w-20 text-xs text-muted-foreground lg:inline">{taskStageLabel(link.status.stage)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ConnectionPanel({ data, renderedAt }: { data: ClickUpPage & { connection: NonNullable<ClickUpPage["connection"]> }; renderedAt: number }) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"token" | "disconnect" | null>(null);
  const [pending, startTransition] = React.useTransition();
  const { connection, live } = data;

  const disconnect = () =>
    startTransition(async () => {
      const result = await disconnectClickUp();
      if (!result.ok) return void toast.error(result.error);
      toast.success("ClickUp disconnected");
      setDialog(null);
      router.refresh();
    });

  const liveLabel = { on: "On", failing: "Not working", off: "Off" }[live.state];
  const liveHint =
    live.detail ??
    (live.state === "off"
      ? "ClickUp can only send changes to ReEdit's public address. Until then, use Sync now on a pipeline."
      : "ClickUp sends changes here as they happen.");

  return (
    <Panel
      title="Connection"
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Connection actions">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl">
            <DropdownMenuItem onSelect={() => setDialog("token")}>
              <KeyRoundIcon /> Change token
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("disconnect")}>
              <UnplugIcon /> Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <dl className="grid grid-cols-1 gap-4 text-sm">
        <Row label="ClickUp workspace">
          <span className="font-medium">{connection.teamName}</span>
        </Row>
        <Row label="Connected as">
          <span className="font-medium">{connection.accountName}</span>
          {connection.accountEmail && <span className="block truncate text-xs text-muted-foreground">{connection.accountEmail}</span>}
        </Row>
        <Row label="Live updates">
          <span className="flex items-center gap-2 font-medium">
            <span
              className={cn(
                "size-2 rounded-full",
                live.state === "on" ? "bg-success" : live.state === "failing" ? "bg-danger" : "bg-muted-foreground/60",
              )}
            />
            {liveLabel}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{liveHint}</span>
        </Row>
        <Row label="Last update">
          <span className="text-muted-foreground">
            {connection.lastEventAt ? timeAgo(connection.lastEventAt, renderedAt) : "None from ClickUp yet"}
          </span>
        </Row>
      </dl>
      <p className="mt-5 text-xs text-muted-foreground">
        ReEdit sees what {connection.accountName} can see in ClickUp, and status changes made here show there as theirs.
      </p>

      <Dialog open={dialog === "token"} onOpenChange={(open) => setDialog(open ? "token" : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Change token</DialogTitle>
            <DialogDescription>Paste a new token for {connection.teamName}. Pipelines and tasks stay as they are.</DialogDescription>
          </DialogHeader>
          <ConnectForm submitLabel="Save token" onDone={() => setDialog(null)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog === "disconnect"} onOpenChange={(open) => !pending && setDialog(open ? "disconnect" : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect ClickUp?</AlertDialogTitle>
            <AlertDialogDescription>
              Syncing stops for every pipeline. Tasks from ClickUp stay here as ordinary ReEdit tasks, your statuses stay as they are,
              and nothing changes in ClickUp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                disconnect();
              }}
            >
              {pending && <Loader2Icon className="animate-spin" />}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
