"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2Icon, Settings2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PROJECT_STAGES } from "@/features/projects/constants";
import { TASK_STAGES } from "@/features/tasks/constants";
import { loadStatuses } from "../actions";
import type { StatusDef, StatusKind } from "../constants";
import type { StatusInUse } from "../queries";
import { StatusList } from "./status-list";

const COPY: Record<StatusKind, { title: string; description: string }> = {
  task: {
    title: "Task statuses",
    description: "The board's columns and the choices on every task.",
  },
  project: {
    title: "Project statuses",
    description: "Where each project is. Clients see a simpler version in their portal.",
  },
};

/**
 * The status editor in a dialog, for the page where the statuses are used
 * (task statuses on Tasks and project pages, project statuses on Projects).
 * It loads the statuses, with how much is in each, every time it opens.
 */
export function StatusManagerDialog({
  kind,
  open,
  onOpenChange,
}: {
  kind: StatusKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [statuses, setStatuses] = React.useState<StatusInUse<StatusDef>[] | null>(null);
  // Bumped after each change to load the list again.
  const [version, setVersion] = React.useState(0);
  const reload = React.useCallback(() => setVersion((v) => v + 1), []);

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    loadStatuses(kind).then((result) => {
      if (!live) return;
      if (result.ok) setStatuses(result.data);
      else toast.error(result.error);
    });
    return () => {
      live = false;
    };
  }, [open, kind, version]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{COPY[kind].title}</DialogTitle>
          <DialogDescription>
            {COPY[kind].description} Each status sits in a stage, and the stage decides how it behaves. Changes save straight
            away.
          </DialogDescription>
        </DialogHeader>
        {statuses ? (
          <StatusList kind={kind} stages={kind === "task" ? TASK_STAGES : PROJECT_STAGES} statuses={statuses} onChanged={reload} />
        ) : (
          <div className="grid h-48 place-items-center" aria-busy="true">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            <span className="sr-only">Loading statuses</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Icon button that opens the status editor. Sits next to "New task" / "New project". */
export function StatusesButton({ kind, onClick }: { kind: StatusKind; onClick: () => void }) {
  const label = `Edit ${kind} statuses`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon" onClick={onClick} aria-label={label}>
          <Settings2Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** The icon button with its own editor, for pages without a task workspace (Projects). */
export function StatusManagerButton({ kind }: { kind: StatusKind }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <StatusesButton kind={kind} onClick={() => setOpen(true)} />
      <StatusManagerDialog kind={kind} open={open} onOpenChange={setOpen} />
    </>
  );
}
