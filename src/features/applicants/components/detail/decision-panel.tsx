"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon, UserCheckIcon, XIcon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { ApplicantStage } from "../../constants";
import { DecisionDialog, type Decision } from "../decision-dialog";

export function DecisionPanel({
  applicant,
}: {
  applicant: { id: string; name: string; email: string; stage: ApplicantStage; editorId: string | null };
}) {
  const [decision, setDecision] = React.useState<Decision | null>(null);
  const person = { id: applicant.id, name: applicant.name, email: applicant.email, editorId: applicant.editorId };

  return (
    <Panel title="Decision">
      {applicant.editorId ? (
        <div className="flex items-center gap-3 rounded-2xl bg-success/8 p-3 ring-1 ring-success/25">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
            <UserCheckIcon className="size-5" />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-medium">Approved and invited</span>
            <span className="block text-muted-foreground">Their editor account is set up.</span>
          </span>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/editors/${applicant.editorId}`}>
              Profile <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {applicant.stage === "rejected"
              ? "You passed on this applicant. You can still approve them."
              : "Approving creates their editor account and emails the Welcome to Foundry invite."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setDecision({ applicant: person, stage: "approved" })}>
              <CheckIcon /> Approve
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
