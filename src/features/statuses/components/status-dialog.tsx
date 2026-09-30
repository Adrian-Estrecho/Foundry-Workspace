"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { FieldGroup, FormRow, submitWith } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveStatus } from "../actions";
import { STATUS_COLORS, STATUS_COLOR_KEYS, STATUS_NAME_MAX, type StageInfo, type StatusColor, type StatusDef, type StatusKind } from "../constants";
import { StatusChip } from "./status-chip";

/**
 * Add a status, or edit one (when `status` is set): name, colour, and the
 * stage it belongs to. The stage can't change while something is in the
 * status, or when it's the stage's only status.
 */
export function StatusDialog({
  kind,
  stages,
  status,
  stage,
  lockedReason,
  open,
  onOpenChange,
}: {
  kind: StatusKind;
  stages: StageInfo[];
  status?: StatusDef;
  /** Where a new status starts. */
  stage?: string;
  /** Why the stage can't be changed, when it can't. */
  lockedReason?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState(status?.name ?? "");
  const [color, setColor] = React.useState<StatusColor>(status?.color ?? "blue");
  const editing = Boolean(status);
  const currentStage = status?.stage ?? stage ?? stages[0].value;
  const noun = kind === "task" ? "task" : "project";

  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await saveStatus(kind, status?.id ?? null, formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success(editing ? "Status saved" : `${String(formData.get("name")).trim()} added`, {
        description: editing ? undefined : `It's on every ${noun} status menu now.`,
      });
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{editing ? "Edit status" : `New ${noun} status`}</DialogTitle>
          <DialogDescription>
            {editing ? "Changes show everywhere straight away." : `Everyone in the workspace can move ${noun}s to it.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submitWith(save)} className="grid gap-5">
          <FormRow label="Name" required error={errors.name}>
            <Input
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={kind === "task" ? "e.g. Color grading" : "e.g. Waiting on footage"}
              maxLength={STATUS_NAME_MAX}
              autoFocus
              required
              aria-invalid={!!errors.name}
            />
          </FormRow>

          <FieldGroup label="Colour" error={errors.color}>
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_COLOR_KEYS.map((key) => (
                <label key={key} className="cursor-pointer" title={STATUS_COLORS[key].label}>
                  <input
                    type="radio"
                    name="color"
                    value={key}
                    checked={color === key}
                    onChange={() => setColor(key)}
                    className="peer sr-only"
                  />
                  <span className="grid size-8 place-items-center rounded-full ring-1 ring-border transition-shadow peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                    <span className={cn("grid size-5 place-items-center rounded-full", STATUS_COLORS[key].dot)}>
                      {color === key && <CheckIcon className="size-3 text-background" strokeWidth={3} />}
                    </span>
                  </span>
                  <span className="sr-only">{STATUS_COLORS[key].label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              Preview <StatusChip status={{ name: name.trim() || "Status", color }} />
            </div>
          </FieldGroup>

          <FieldGroup
            label="Stage"
            error={errors.stage}
            hint={lockedReason ?? `The stage decides how ${noun}s in this status behave.`}
          >
            {lockedReason && <input type="hidden" name="stage" value={currentStage} />}
            <div className="grid max-h-72 gap-1.5 overflow-y-auto">
              {stages.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg bg-surface px-3 py-2.5 ring-1 ring-border transition-colors has-checked:bg-primary/8 has-checked:ring-primary/50 has-focus-visible:ring-2 has-focus-visible:ring-ring",
                    lockedReason && "cursor-default opacity-60 has-checked:opacity-100",
                  )}
                >
                  <input
                    type="radio"
                    name={lockedReason ? undefined : "stage"}
                    value={option.value}
                    defaultChecked={option.value === currentStage}
                    disabled={Boolean(lockedReason)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2Icon className="animate-spin" />}
              {editing ? "Save status" : "Add status"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
