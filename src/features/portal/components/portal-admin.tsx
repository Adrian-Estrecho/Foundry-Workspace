"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeOffIcon,
  GlobeIcon,
  Loader2Icon,
  MessagesSquareIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Panel } from "@/components/shared/panel";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { timeAgo } from "@/lib/dates";
import { closeClientPortal, openClientPortal, resetClientPortal } from "../actions";

export type PortalInfo = { token: string; enabled: boolean; lastViewedAt: string | null } | null;

/** A read-only link with Copy and Open. */
export function CopyLinkField({ url, label = "Portal link" }: { url: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  };
  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={url} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="h-9 font-mono text-xs" />
      <Button type="button" variant="secondary" size="icon" onClick={copy} aria-label="Copy link">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <Button asChild variant="secondary" size="icon">
        <a href={url} target="_blank" rel="noreferrer" aria-label="Open the portal">
          <ExternalLinkIcon />
        </a>
      </Button>
    </div>
  );
}

/**
 * On the client's page: their private portal link, where they follow their
 * projects' tasks and message the team (no login). Admins create it, copy
 * it, replace it (the old link stops working) or turn it off.
 */
export function ClientPortalPanel({
  clientId,
  clientName,
  portal,
  siteUrl,
  renderedAt,
}: {
  clientId: string;
  clientName: string;
  portal: PortalInfo;
  siteUrl: string;
  renderedAt: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [resetOpen, setResetOpen] = React.useState(false);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.error ?? "Something went wrong.");
      toast.success(success);
      router.refresh();
    });

  const url = portal ? `${siteUrl}/portal/${portal.token}` : "";

  return (
    <Panel
      title="Client portal"
      description={portal?.enabled ? "Their private page: tasks, progress and messages." : undefined}
      action={
        portal?.enabled ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Portal actions" disabled={pending}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onSelect={() => setResetOpen(true)}>
                <RefreshCwIcon /> Make a new link
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => run(() => closeClientPortal(clientId), "Portal turned off")}>
                <EyeOffIcon /> Turn off
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <GlobeIcon className="size-5 text-muted-foreground" />
        )
      }
    >
      {!portal ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Give {clientName} a private page to follow every task you&apos;re doing for them (board, list and calendar) and to message
            you. No login: whoever has the link can see it.
          </p>
          <Button onClick={() => run(() => openClientPortal(clientId), "Portal created")} disabled={pending} className="justify-self-start">
            {pending ? <Loader2Icon className="animate-spin" /> : <GlobeIcon />} Create portal link
          </Button>
        </div>
      ) : !portal.enabled ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">The portal is off, so its link doesn&apos;t open. Turning it back on keeps the same link.</p>
          <Button variant="secondary" onClick={() => run(() => openClientPortal(clientId), "Portal is back on")} disabled={pending} className="justify-self-start">
            Turn back on
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          <CopyLinkField url={url} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{portal.lastViewedAt ? `Last opened ${timeAgo(portal.lastViewedAt, renderedAt)}` : "Not opened yet"}</span>
            <Link href={`/messages/clients/${clientId}`} className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline">
              <MessagesSquareIcon className="size-3.5" /> Messages
            </Link>
          </div>
        </div>
      )}

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make a new link?</AlertDialogTitle>
            <AlertDialogDescription>
              The current link stops working straight away. Use this if it was shared with someone it shouldn&apos;t have been. Send{" "}
              {clientName} the new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await resetClientPortal(clientId);
                  if (!result.ok) return void toast.error(result.error);
                  toast.success("New link ready. The old one no longer works.");
                  setResetOpen(false);
                  router.refresh();
                });
              }}
              disabled={pending}
            >
              Make a new link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

/**
 * From a project page: the client's portal link, opened on this project.
 * Creates the portal first if the client doesn't have one.
 */
export function ProjectPortalDialog({
  open,
  onOpenChange,
  client,
  projectId,
  portal,
  siteUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: { id: string; name: string };
  projectId: string;
  portal: PortalInfo;
  siteUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [token, setToken] = React.useState(portal?.enabled ? portal.token : null);

  const [synced, setSynced] = React.useState(portal);
  if (synced !== portal) {
    setSynced(portal);
    setToken(portal?.enabled ? portal.token : null);
  }

  const create = () =>
    startTransition(async () => {
      const result = await openClientPortal(client.id);
      if (!result.ok) return void toast.error(result.error);
      setToken(result.data.token);
      toast.success(portal ? "Portal is back on" : "Portal created");
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Share with {client.name}</DialogTitle>
          <DialogDescription>
            Their private portal, opened on this project: every task as a board, list and calendar, plus messages with you. No login
            needed.
          </DialogDescription>
        </DialogHeader>
        {token ? (
          <div className="grid gap-2">
            <CopyLinkField url={`${siteUrl}/portal/${token}?project=${projectId}`} label="Link to this project" />
            <p className="text-xs text-muted-foreground">
              They can switch to their other projects from there. Manage the link on the{" "}
              <Link href={`/clients/${client.id}`} className="font-medium text-foreground hover:underline">
                client page
              </Link>
              .
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {portal ? `${client.name}'s portal is turned off.` : `${client.name} doesn't have a portal yet.`}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!token && (
            <Button onClick={create} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <GlobeIcon />}
              {portal ? "Turn the portal on" : "Create portal link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
