"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, MailIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { approveApplicant, rejectApplicant } from "../actions";

export type Decision = {
  applicant: { id: string; name: string; email: string; editorId: string | null };
  stage: "approved" | "rejected";
  /** Set when the card was dropped on the column. */
  position?: number;
};

/**
 * Confirms approving or rejecting an applicant. Approving creates their
 * account and emails the invite; rejecting can email a short note.
 * `onDone(true)` once saved, `onDone(false)` if cancelled or it failed.
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
  const approving = stage === "approved";
  const hasAccount = Boolean(applicant.editorId);

  const confirm = () =>
    startTransition(async () => {
      if (approving) {
        const result = await approveApplicant(applicant.id, decision.position);
        if (!result.ok) {
          toast.error(result.error);
          onDone(false);
          router.refresh();
          return;
        }
        const editorId = result.data.editorId;
        toast.success(result.data.invited ? `${applicant.name} approved. Invite sent.` : `${applicant.name} moved to Approved`, {
          description: result.data.invited ? `Welcome email on its way to ${applicant.email}` : undefined,
          action: { label: "Open profile", onClick: () => router.push(`/editors/${editorId}`) },
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
          <DialogTitle className="text-xl">
            {approving ? `Approve ${applicant.name}?` : `Reject ${applicant.name}?`}
          </DialogTitle>
          <DialogDescription>
            {approving
              ? hasAccount
                ? "They already have a Foundry account, so this just moves them to Approved."
                : `This creates their Foundry account and emails a Welcome to Foundry invite to ${applicant.email}. They choose a password, then start onboarding.`
              : "They move to Rejected. You can still move them back later."}
          </DialogDescription>
        </DialogHeader>

        {!approving && (
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
          <Button variant={approving ? "default" : "destructive"} onClick={confirm} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : approving ? <CheckIcon /> : <XIcon />}
            {approving ? (hasAccount ? "Approve" : "Approve & send invite") : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
