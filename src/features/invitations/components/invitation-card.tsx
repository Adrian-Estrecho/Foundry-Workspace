"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BanIcon, CopyIcon, Loader2Icon, MailIcon, TicketIcon } from "lucide-react";
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
import { resendInvitation, revokeInvitation } from "../actions";
import { formatInviteCode, INVITATION_STATE_LABEL } from "../constants";
import type { InvitationRow } from "../queries";

const STATE_CLASS: Record<InvitationRow["state"], string> = {
  pending: "bg-primary/12 text-primary",
  accepted: "bg-success/12 text-success",
  revoked: "bg-muted text-muted-foreground",
  expired: "bg-warning/12 text-warning",
};

const shortDate = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));

/**
 * One invitation: its code and state, with Copy link, Resend and Revoke
 * while it's open. `showName` for lists of several (the roster).
 */
export function InvitationCard({ invitation, showName = false }: { invitation: InvitationRow; showName?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirmRevoke, setConfirmRevoke] = React.useState(false);
  const open = invitation.state === "pending" || invitation.state === "expired";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invitation.link);
      toast.success("Invitation link copied", { description: `Code ${formatInviteCode(invitation.code)}` });
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const resend = () =>
    startTransition(async () => {
      const result = await resendInvitation(invitation.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Invitation sent again", { description: `Good for another 14 days. Sent to ${invitation.email}` });
      router.refresh();
    });

  const revoke = () =>
    startTransition(async () => {
      const result = await revokeInvitation(invitation.id);
      setConfirmRevoke(false);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Invitation revoked", { description: "The code no longer works." });
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg bg-surface p-3 ring-1 ring-border">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <TicketIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        {showName && (
          <p className="truncate text-sm font-medium">
            {invitation.name ?? invitation.email ?? "Invitation"}
            {invitation.name && invitation.email && (
              <span className="font-normal text-muted-foreground"> · {invitation.email}</span>
            )}
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-mono font-medium tracking-wide">{formatInviteCode(invitation.code)}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATE_CLASS[invitation.state])}>
            {INVITATION_STATE_LABEL[invitation.state]}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {invitation.state === "accepted"
            ? "They joined with this code."
            : invitation.state === "revoked"
              ? "This code no longer works."
              : `${invitation.sentAt ? `Sent ${shortDate(invitation.sentAt)} · ` : ""}${
                  invitation.state === "expired" ? "Expired" : "Works until"
                } ${shortDate(invitation.expiresAt)}`}
        </p>
      </div>
      {open && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={copy} className="bg-card ring-1 ring-border">
            <CopyIcon /> Copy link
          </Button>
          {invitation.email && (
            <Button size="sm" variant="secondary" onClick={resend} disabled={pending} className="bg-card ring-1 ring-border">
              {pending ? <Loader2Icon className="animate-spin" /> : <MailIcon />} Resend
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(true)} disabled={pending}>
            <BanIcon /> Revoke
          </Button>
        </div>
      )}

      <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              Code {formatInviteCode(invitation.code)} stops working straight away.
              {invitation.applicantId && " Their application goes back to Shortlisted."} You can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                revoke();
              }}
            >
              Revoke invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
