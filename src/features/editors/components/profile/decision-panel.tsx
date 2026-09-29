"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, MailIcon, XIcon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, firstName } from "@/lib/utils";
import { approveEditor, rejectEditor } from "../../review-actions";

/**
 * The last step of onboarding: approve (full access to the workspace) or
 * don't take them on (access ends). Shown while the editor is onboarding.
 */
export function OnboardingDecisionPanel({
  editorId,
  editorName,
  workspaceName,
  stepsDone,
  stepsTotal,
  missing,
}: {
  editorId: string;
  editorName: string;
  workspaceName: string;
  stepsDone: number;
  stepsTotal: number;
  /** Labels of the steps still open. */
  missing: string[];
}) {
  const [dialog, setDialog] = React.useState<"approve" | "reject" | null>(null);
  const ready = stepsDone === stepsTotal;
  const name = firstName(editorName);

  return (
    <Panel title="Final decision" description="They only see their onboarding until you approve them.">
      <div
        className={cn(
          "mb-4 rounded-lg p-3 text-sm ring-1",
          ready ? "bg-success/8 text-success ring-success/25" : "bg-surface text-muted-foreground ring-border",
        )}
      >
        {ready ? (
          <>
            <span className="font-medium">Every step is done.</span> {name} is ready for your decision.
          </>
        ) : (
          <>
            {stepsDone} of {stepsTotal} steps done. Still open: {missing.join(", ")}.
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setDialog("approve")}>
          <CheckIcon /> Approve
        </Button>
        <Button variant="outline" onClick={() => setDialog("reject")}>
          <XIcon /> Don&apos;t take on
        </Button>
      </div>
      <DecisionDialog
        kind={dialog}
        onClose={() => setDialog(null)}
        editorId={editorId}
        name={name}
        workspaceName={workspaceName}
        missing={missing}
      />
    </Panel>
  );
}

function DecisionDialog({
  kind,
  onClose,
  editorId,
  name,
  workspaceName,
  missing,
}: {
  kind: "approve" | "reject" | null;
  onClose: () => void;
  editorId: string;
  name: string;
  workspaceName: string;
  missing: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [notify, setNotify] = React.useState(true);
  if (!kind) return null;
  const approving = kind === "approve";

  const confirm = () =>
    startTransition(async () => {
      const result = approving ? await approveEditor(editorId) : await rejectEditor(editorId, notify);
      if (!result.ok) return void toast.error(result.error);
      toast.success(approving ? `${name} is on the team` : `${name} wasn't taken on`, {
        description: approving ? "They have full access now, and we've emailed them." : undefined,
      });
      onClose();
      router.refresh();
    });

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{approving ? `Approve ${name}?` : `Don't take ${name} on?`}</DialogTitle>
          <DialogDescription>
            {approving
              ? `${name} gets full access to ${workspaceName}: projects, tasks, attendance and announcements. We'll email them.`
              : `Their access to ${workspaceName} ends. Their history stays, and you can invite them again later.`}
          </DialogDescription>
        </DialogHeader>
        {approving && missing.length > 0 && (
          <p className="rounded-lg bg-warning/10 px-3 py-2.5 text-sm text-warning ring-1 ring-warning/25">
            Not everything is done yet: {missing.join(", ")}. You can still approve them.
          </p>
        )}
        {!approving && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface p-3 ring-1 ring-border">
            <Checkbox checked={notify} onCheckedChange={(checked) => setNotify(checked === true)} className="mt-0.5" />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <MailIcon className="size-3.5" /> Email them a short note
              </span>
              <span className="mt-0.5 block text-muted-foreground">A polite thank-you saying you won&apos;t be moving forward.</span>
            </span>
          </label>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={approving ? "default" : "destructive"} onClick={confirm} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : approving ? <CheckIcon /> : <XIcon />}
            {approving ? "Approve & give access" : "Don't take on"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
