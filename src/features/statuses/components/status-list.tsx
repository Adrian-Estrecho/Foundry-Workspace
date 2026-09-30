"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { removeStatus, reorderStatuses } from "../actions";
import type { StageInfo, StatusDef, StatusKind } from "../constants";
import type { StatusInUse } from "../queries";
import { StatusDot } from "./status-chip";
import { StatusDialog } from "./status-dialog";

type Status = StatusInUse<StatusDef>;

const count = (n: number, kind: StatusKind) => `${n} ${kind}${n === 1 ? "" : "s"}`;

/**
 * The workspace's statuses in their order, which is the order of the board's
 * columns and of every status menu. Owners and admins drag (or use the
 * arrows) to reorder, and add, edit and remove statuses; changes save
 * straight away. Each row shows its stage, which decides how it behaves.
 */
export function StatusList({ kind, stages, statuses }: { kind: StatusKind; stages: StageInfo[]; statuses: Status[] }) {
  const router = useRouter();
  const [order, setOrder] = React.useState(statuses);
  const [synced, setSynced] = React.useState(statuses);
  const [saving, setSaving] = React.useState(false);
  const [dialog, setDialog] = React.useState<{ key: number; status?: Status; stage?: string } | null>(null);
  const [removing, setRemoving] = React.useState<Status | null>(null);
  // Fresh server data replaces the local order (not while a move is saving).
  if (statuses !== synced && !saving) {
    setSynced(statuses);
    setOrder(statuses);
  }

  const dndId = React.useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const stageLabel = (stage: string) => stages.find((s) => s.value === stage)?.label ?? stage;
  const nameOf = (id: string | number) => order.find((s) => s.id === id)?.name ?? "Status";
  const positionOf = (id: string | number) => order.findIndex((s) => s.id === id) + 1;
  const siblings = (status: Status) => order.filter((s) => s.stage === status.stage && s.id !== status.id);
  const open = (next: { status?: Status; stage?: string }) => setDialog((d) => ({ key: (d?.key ?? 0) + 1, ...next }));

  const save = async (next: Status[]) => {
    const before = order;
    setOrder(next);
    setSaving(true);
    const result = await reorderStatuses(
      kind,
      next.map((s) => s.id),
    );
    setSaving(false);
    if (!result.ok) {
      setOrder(before);
      return void toast.error(result.error);
    }
    router.refresh();
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    void save(arrayMove(order, from, to));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(
      order.findIndex((s) => s.id === active.id),
      order.findIndex((s) => s.id === over.id),
    );
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, position ${positionOf(active.id)} of ${order.length}.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} is over position ${positionOf(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} dropped at position ${positionOf(over.id)}.` : `${nameOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  };

  const lockedReason = (status: Status | undefined) => {
    if (!status) return null;
    if (status.count > 0) return `${count(status.count, kind)} ${status.count === 1 ? "is" : "are"} in this status, so its stage stays put.`;
    if (siblings(status).length === 0) return "It's the only status in its stage, so its stage stays put.";
    return null;
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 basis-48 text-xs text-muted-foreground">
          Drag to change the order{kind === "task" ? ": it's the order of the board's columns." : "."}
        </p>
        <Button type="button" size="sm" variant="secondary" className="bg-surface-strong ring-1 ring-border" onClick={() => open({ stage: stages[1]?.value })}>
          <PlusIcon /> Add status
        </Button>
      </div>

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements }}>
        <SortableContext items={order.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="divide-y rounded-lg bg-surface ring-1 ring-border" aria-busy={saving}>
            {order.map((status, index) => (
              <StatusRow
                key={status.id}
                status={status}
                kind={kind}
                stage={stageLabel(status.stage)}
                first={index === 0}
                last={index === order.length - 1}
                saving={saving}
                onlyInStage={siblings(status).length === 0}
                onMove={(direction) => move(index, index + direction)}
                onEdit={() => open({ status })}
                onRemove={() => setRemoving(status)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

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

function StatusRow({
  status,
  kind,
  stage,
  first,
  last,
  saving,
  onlyInStage,
  onMove,
  onEdit,
  onRemove,
}: {
  status: Status;
  kind: StatusKind;
  stage: string;
  first: boolean;
  last: boolean;
  saving: boolean;
  onlyInStage: boolean;
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: status.id,
    disabled: saving,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 bg-surface py-1.5 pr-1.5 pl-1 first:rounded-t-lg last:rounded-b-lg",
        isDragging && "relative z-10 rounded-lg shadow-lg ring-1 ring-border",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${status.name} to reorder`}
        className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <StatusDot color={status.color} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onEdit}
          className="block max-w-full truncate rounded text-left text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {status.name}
        </button>
        <p className="truncate text-xs text-muted-foreground">
          {status.name.toLowerCase() !== stage.toLowerCase() && `${stage} stage · `}
          {count(status.count, kind)}
        </p>
      </div>
      <span className="flex shrink-0">
        <Button type="button" variant="ghost" size="icon-sm" disabled={first || saving} onClick={() => onMove(-1)} aria-label={`Move ${status.name} up`}>
          <ArrowUpIcon />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={last || saving} onClick={() => onMove(1)} aria-label={`Move ${status.name} down`}>
          <ArrowDownIcon />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${status.name}`}>
          <PencilIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-danger"
          disabled={onlyInStage}
          title={onlyInStage ? "Every stage needs at least one status" : undefined}
          onClick={onRemove}
          aria-label={`Remove ${status.name}`}
        >
          <Trash2Icon />
        </Button>
      </span>
    </li>
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
