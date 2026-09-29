"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, MailIcon, SendIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inviteApplicant } from "@/features/invitations/actions";
import { formatInviteCode } from "@/features/invitations/constants";
import { rejectApplicant } from "../actions";
import type { DecisionStage } from "../constants";

export type Decision = {
  applicant: { id: string; name: string; email: string };
  stage: DecisionStage;
  /** Set when the card was dropped on the column. */
  position?: number;
};

/**
 * Confirms inviting or rejecting an applicant. Inviting emails them a code to
 * join the workspace; rejecting can email a short note. `onDone(true)` once
 * saved, `onDone(false)` if cancelled or it failed.
 */
export function DecisionDialog({ decision, onDone }: { decision: Decision | null; onDone: (ok: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [notify, setNotify] = React.useState(false);
  const [shown, setShown] = React.useState(decision);
  if (decision !== shown) {
    setShown(decision);
    if (decision) setNotify(false);
  }

  if (!decision) return null;
  const { applicant, stage } = decision;
  const inviting = stage === "invited";

  const confirm = () =>
    startTransition(async () => {
      if (inviting) {
        const result = await inviteApplicant(applicant.id, decision.position);
        if (!result.ok) {
          toast.error(result.error);
          onDone(false);
          router.refresh();
          return;
        }
        toast.success(`${applicant.name} invited`, {
          description: `Code ${formatInviteCode(result.data.code)} is on its way to ${applicant.email}`,
        });
      } else {
        const result = await rejectApplicant(applicant.id, notify, decision.position);
        if (!result.ok) {
          toast.error(result.error);
          onDone(false);
          return;
        }
        toast.success(notify ? `${applicant.name} rejected. Note sent.` : `${applicant.name} moved to Rejected`);
      }
      onDone(true);
      router.refresh();
    });

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onDone(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{inviting ? `Invite ${applicant.name} to join?` : `Reject ${applicant.name}?`}</DialogTitle>
          <DialogDescription>
            {inviting
              ? `We'll email ${applicant.email} an invitation code. They sign up (or sign in), enter it, and start onboarding with limited access: setup steps, the test edit and an interview. You approve them at the end.`
              : "They move to Rejected, and any invitation you sent stops working. You can still move them back later."}
          </DialogDescription>
        </DialogHeader>

        {!inviting && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface p-3 ring-1 ring-border">
            <Checkbox checked={notify} onCheckedChange={(checked) => setNotify(checked === true)} className="mt-0.5" />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <MailIcon className="size-3.5" /> Email them a short note
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                A polite thank-you saying you won&apos;t be moving forward right now.
              </span>
            </span>
          </label>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onDone(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant={inviting ? "default" : "destructive"} onClick={confirm} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : inviting ? <SendIcon /> : <XIcon />}
            {inviting ? "Send invitation" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
