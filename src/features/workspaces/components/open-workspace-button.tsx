"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { switchWorkspace } from "../actions";

/** A row on the welcome page that opens one of the user's workspaces. */
export function OpenWorkspaceButton({ workspaceId, children }: { workspaceId: string; children: React.ReactNode }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await switchWorkspace(workspaceId);
          if (result && !result.ok) toast.error(result.error);
        })
      }
      className="flex w-full items-center gap-3 rounded-lg bg-card p-3 ring-1 ring-border transition-colors hover:bg-accent/50 disabled:opacity-70"
    >
      {children}
      {pending && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
    </button>
  );
}
