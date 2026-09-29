"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, SquareIcon } from "lucide-react";
import { FormRow } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDuration, formatTime } from "@/lib/dates";
import { firstName } from "@/lib/utils";
import { endShiftFor } from "../actions";

function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * An admin stops a shift someone left running: now, or at the time they
 * really stopped (time after that doesn't count). The editor is told.
 */
export function EndShiftDialog({
  editor,
  onOpenChange,
}: {
  editor: { id: string; name: string; clockInAt: string | null; timeZone: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [when, setWhen] = React.useState<"now" | "earlier">("now");
  const [endedAt, setEndedAt] = React.useState("");

  const [shownFor, setShownFor] = React.useState<string | null>(null);
  if ((editor?.id ?? null) !== shownFor) {
    setShownFor(editor?.id ?? null);
    setWhen("now");
    setEndedAt("");
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    if (when === "earlier" && !endedAt) return void toast.error("Pick when they stopped.");
    startTransition(async () => {
      const result = await endShiftFor({
        editorId: editor.id,
        endedAt: when === "earlier" ? new Date(endedAt).toISOString() : null,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${firstName(editor.name)}'s shift ended`, { description: `${formatDuration(result.data.seconds)} logged` });
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={!!editor} onOpenChange={onOpenChange}>
      {editor && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">End {firstName(editor.name)}&apos;s shift?</DialogTitle>
            <DialogDescription>
              {editor.clockInAt
                ? `Started ${formatTime(editor.clockInAt, editor.timeZone, true)}. `
                : ""}
              Use this when someone forgot to stop. They&apos;ll get a notification.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <fieldset className="grid gap-2">
              <legend className="sr-only">When did they stop?</legend>
              <label className="flex items-center gap-3 rounded-lg bg-surface p-3 text-sm ring-1 ring-border has-checked:ring-primary/60">
                <input type="radio" name="when" checked={when === "now"} onChange={() => setWhen("now")} className="accent-primary" />
                End it now
              </label>
              <label className="flex items-center gap-3 rounded-lg bg-surface p-3 text-sm ring-1 ring-border has-checked:ring-primary/60">
                <input type="radio" name="when" checked={when === "earlier"} onChange={() => setWhen("earlier")} className="accent-primary" />
                They stopped earlier
              </label>
            </fieldset>
            {when === "earlier" && (
              <FormRow label="Stopped at" hint="In your time. Time logged after this doesn't count.">
                <Input
                  type="datetime-local"
                  value={endedAt}
                  onChange={(event) => setEndedAt(event.target.value)}
                  min={editor.clockInAt ? localInputValue(new Date(editor.clockInAt)) : undefined}
                  max={localInputValue(new Date())}
                  required
                />
              </FormRow>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? <Loader2Icon className="animate-spin" /> : <SquareIcon className="fill-current" />}
                End shift
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
