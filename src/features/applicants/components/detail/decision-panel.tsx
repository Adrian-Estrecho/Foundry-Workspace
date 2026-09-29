"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, SendIcon, UserCheckIcon, XIcon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { InvitationCard } from "@/features/invitations/components/invitation-card";
import type { InvitationRow } from "@/features/invitations/queries";
import type { ApplicantStage } from "../../constants";
import { DecisionDialog, type Decision } from "../decision-dialog";

/**
 * Invite or reject. Once invited, the code with Copy, Resend and Revoke;
 * once they've joined, a link to their onboarding.
 */
export function DecisionPanel({
  applicant,
  invitation,
}: {
  applicant: { id: string; name: string; email: string; stage: ApplicantStage; editorId: string | null };
  invitation: InvitationRow | null;
}) {
  const [decision, setDecision] = React.useState<Decision | null>(null);
  const person = { id: applicant.id, name: applicant.name, email: applicant.email };
  const openInvitation = invitation && (invitation.state === "pending" || invitation.state === "expired") ? invitation : null;

  return (
    <Panel title="Decision">
      {applicant.stage === "joined" && applicant.editorId ? (
        <div className="flex items-center gap-3 rounded-lg bg-success/8 p-3 ring-1 ring-success/25">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
            <UserCheckIcon className="size-5" />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-medium">Joined the team</span>
            <span className="block text-muted-foreground">Follow their onboarding on their profile.</span>
          </span>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/editors/${applicant.editorId}`}>
              Profile <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      ) : openInvitation ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Invited. Waiting for them to join with this code. They start onboarding as soon as they do.
          </p>
          <InvitationCard invitation={openInvitation} />
          <Button variant="outline" onClick={() => setDecision({ applicant: person, stage: "rejected" })}>
            <XIcon /> Reject instead
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {applicant.stage === "rejected"
              ? "You passed on this applicant. You can still invite them."
              : "Inviting emails them a code to join your workspace. They start onboarding with limited access until you approve them."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setDecision({ applicant: person, stage: "invited" })}>
              <SendIcon /> Invite to join
            </Button>
            <Button
              variant="outline"
              onClick={() => setDecision({ applicant: person, stage: "rejected" })}
              disabled={applicant.stage === "rejected"}
            >
              <XIcon /> Reject
            </Button>
          </div>
        </>
      )}
      <DecisionDialog decision={decision} onDone={() => setDecision(null)} />
    </Panel>
  );
}
