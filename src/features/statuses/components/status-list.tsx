"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownIcon, ArrowUpIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { NativeSelect } from "@/components/shared/form";
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
import { moveStatus, removeStatus } from "../actions";
import type { StageInfo, StatusDef, StatusKind } from "../constants";
import type { StatusInUse } from "../queries";
import { StatusDot } from "./status-chip";
import { StatusDialog } from "./status-dialog";

type Status = StatusInUse<StatusDef>;

const count = (n: number, kind: StatusKind) => `${n} ${kind}${n === 1 ? "" : "s"}`;

/**
 * The workspace's statuses, grouped by stage. Owners and admins add, edit,
 * reorder (within a stage) and remove them; changes save straight away.
 */
export function StatusList({ kind, stages, statuses }: { kind: StatusKind; stages: StageInfo[]; statuses: Status[] }) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<{ key: number; status?: Status; stage?: string } | null>(null);
  const [removing, setRemoving] = React.useState<Status | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const open = (next: { status?: Status; stage?: string }) => setDialog((d) => ({ key: (d?.key ?? 0) + 1, ...next }));
  const siblings = (status: Status) => statuses.filter((s) => s.stage === status.stage && s.id !== status.id);

  const move = async (status: Status, direction: -1 | 1) => {
    setBusy(status.id);
    const result = await moveStatus(kind, status.id, direction);
    setBusy(null);
    if (!result.ok) return void toast.error(result.error);
    router.refresh();
  };

  const lockedReason = (status: Status | undefined) => {
    if (!status) return null;
    if (status.count > 0) return `${count(status.count, kind)} ${status.count === 1 ? "is" : "are"} in this status, so its stage stays put.`;
    if (siblings(status).length === 0) return "It's the only status in its stage, so its stage stays put.";
    return null;
  };

  return (
    <div className="grid gap-5">
      {stages.map((stage) => {
        const inStage = statuses.filter((s) => s.stage === stage.value);
        return (
          <div key={stage.value} className="grid gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{stage.label}</p>
                <p className="text-xs text-muted-foreground">{stage.hint}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
                onClick={() => open({ stage: stage.value })}
                aria-label={`Add a status to ${stage.label}`}
              >
                <PlusIcon /> Add
              </Button>
            </div>
            <ul className="divide-y rounded-lg bg-surface ring-1 ring-border">
              {inStage.map((status, index) => (
                <li key={status.id} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
                  <StatusDot color={status.color} />
                  <button
                    type="button"
                    onClick={() => open({ status })}
                    className="min-w-0 flex-1 truncate rounded text-left text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {status.name}
                  </button>
                  <span className="shrink-0 text-xs text-muted-foreground tabular">{count(status.count, kind)}</span>
                  {busy === status.id ? (
                    <Loader2Icon className="mx-2 size-4 animate-spin text-muted-foreground" />
                  ) : (
                    inStage.length > 1 && (
                      <span className="flex shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === 0 || busy !== null}
                          onClick={() => move(status, -1)}
                          aria-label={`Move ${status.name} up`}
                        >
                          <ArrowUpIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === inStage.length - 1 || busy !== null}
                          onClick={() => move(status, 1)}
                          aria-label={`Move ${status.name} down`}
                        >
                          <ArrowDownIcon />
                        </Button>
                      </span>
                    )
                  )}
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => open({ status })} aria-label={`Edit ${status.name}`}>
                    <PencilIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-danger"
                    disabled={inStage.length === 1}
                    title={inStage.length === 1 ? "Every stage needs at least one status" : undefined}
                    onClick={() => setRemoving(status)}
                    aria-label={`Remove ${status.name}`}
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {dialog && (
        <StatusDialog
          key={dialog.key}
          open
          onOpenChange={(value) => !value && setDialog(null)}
          kind={kind}
          stages={stages}
          status={dialog.status}
          stage={dialog.stage}
          lockedReason={lockedReason(dialog.status)}
        />
      )}

      <RemoveDialog
        kind={kind}
        status={removing}
        targets={removing ? siblings(removing) : []}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}

/** Confirms a removal, and asks where anything in the status should go. */
function RemoveDialog({
  kind,
  status,
  targets,
  onClose,
}: {
  kind: StatusKind;
  status: Status | null;
  targets: Status[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [moveTo, setMoveTo] = React.useState("");
  const [shown, setShown] = React.useState(status);
  if (status !== shown) {
    setShown(status);
    setMoveTo(targets[0]?.id ?? "");
  }

  const remove = () =>
    startTransition(async () => {
      if (!status) return;
      const result = await removeStatus(kind, status.id, status.count > 0 ? moveTo : null);
      if (!result.ok) return void toast.error(result.error);
      const target = targets.find((t) => t.id === moveTo);
      toast.success(`${status.name} removed`, {
        description: status.count > 0 && target ? `${count(status.count, kind)} moved to ${target.name}.` : undefined,
      });
      onClose();
      router.refresh();
    });

  return (
    <AlertDialog open={!!status} onOpenChange={(value) => !value && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {status?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {status && status.count > 0
              ? `${count(status.count, kind)} ${status.count === 1 ? "is" : "are"} in it. Pick where ${status.count === 1 ? "it goes" : "they go"}: they stay in the same stage, so nobody is notified.`
              : `Nothing is in it right now. It comes off every ${kind} status menu.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {status && status.count > 0 && (
          <NativeSelect aria-label="Move them to" value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending || (!!status && status.count > 0 && !moveTo)}
            onClick={(event) => {
              event.preventDefault();
              remove();
            }}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Remove status
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
