"use client";

import * as React from "react";
import Link from "next/link";
import { CheckIcon, ChevronsUpDownIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { switchWorkspace } from "../actions";
import { WORKSPACE_CHANNEL } from "../constants";

export type SwitcherWorkspace = { id: string; name: string; label: string; logoUrl: string | null };

/** The workspace's logo, or its initial on an accent-tinted tile. */
export function WorkspaceTile({ name, logoUrl, className }: { name: string; logoUrl?: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-7 shrink-0 place-items-center overflow-hidden rounded-md bg-primary/15 font-heading text-sm font-semibold text-primary",
        logoUrl && "bg-surface ring-1 ring-border",
        className,
      )}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- storage URL, already small
        <img src={logoUrl} alt="" className="size-full object-cover" />
      ) : (
        name.trim().charAt(0).toUpperCase() || "?"
      )}
    </span>
  );
}

/**
 * Top of the sidebar: which workspace you're in, and the others you can
 * switch to. Switching changes what every page shows, so other open tabs
 * reload too.
 */
export function WorkspaceSwitcher({
  current,
  workspaces,
  expanded = true,
  className,
}: {
  current: SwitcherWorkspace;
  workspaces: SwitcherWorkspace[];
  expanded?: boolean;
  className?: string;
}) {
  const [pending, startTransition] = React.useTransition();

  const open = (id: string) => {
    if (id === current.id) return;
    startTransition(async () => {
      const result = await switchWorkspace(id);
      if (result && !result.ok) toast.error(result.error);
    });
  };

  const trigger = (
    <DropdownMenuTrigger
      className={cn(
        "flex h-10 w-full min-w-0 items-center gap-2.5 rounded-lg text-left outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
        expanded ? "px-2" : "justify-center",
        className,
      )}
      aria-label={`Workspace: ${current.name}. Switch workspace`}
    >
      <WorkspaceTile name={current.name} logoUrl={current.logoUrl} />
      {expanded && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{current.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{current.label}</span>
          </span>
          {pending ? (
            <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
        </>
      )}
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu>
      {expanded ? (
        trigger
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">{current.name}</TooltipContent>
        </Tooltip>
      )}
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Workspaces</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem key={workspace.id} disabled={pending} onSelect={() => open(workspace.id)} className="gap-2.5">
            <WorkspaceTile name={workspace.name} logoUrl={workspace.logoUrl} className="size-6 text-xs" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{workspace.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{workspace.label}</span>
            </span>
            {workspace.id === current.id && <CheckIcon className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/welcome">
            <PlusIcon /> Create or join a workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The active workspace belongs to the account, not the tab. Each tab says
 * which workspace it is showing, and reloads when another tab shows a
 * different one (after a switch), so it never acts on stale data.
 */
export function WorkspaceSync({ workspaceId }: { workspaceId: string }) {
  React.useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(WORKSPACE_CHANNEL);
    channel.onmessage = (event) => {
      if (event.data !== workspaceId) window.location.reload();
    };
    channel.postMessage(workspaceId);
    return () => channel.close();
  }, [workspaceId]);
  return null;
}
