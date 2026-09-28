"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightIcon, ExternalLinkIcon, LinkIcon, MoreHorizontalIcon, SearchIcon, SendIcon, Trash2Icon } from "lucide-react";
import { KanbanBoard } from "@/components/shared/kanban-board";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { deleteApplicant, moveApplicant, setApplicantStage } from "../actions";
import { APPLICANT_STAGES, applicantStageLabel, type ApplicantStage } from "../constants";
import type { PipelineApplicant } from "../queries";
import { ApplicantCard } from "./applicant-card";
import { DecisionDialog, type Decision } from "./decision-dialog";
import { SendTestDialog } from "./send-test-dialog";

const COLUMNS = APPLICANT_STAGES.map((stage) => ({ id: stage.value, label: stage.label, dot: stage.dot }));
const isDecision = (stage: ApplicantStage): stage is Decision["stage"] => stage === "approved" || stage === "rejected";

export function ApplicantPipeline({
  applicants,
  lastTestEditUrl,
  today,
}: {
  applicants: PipelineApplicant[];
  lastTestEditUrl: string | null;
  today: string;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [decision, setDecision] = React.useState<(Decision & { resolve?: (ok: boolean) => void }) | null>(null);
  const [testFor, setTestFor] = React.useState<{ applicant: PipelineApplicant; prompted: boolean } | null>(null);
  const [toDelete, setToDelete] = React.useState<PipelineApplicant | null>(null);
  const [deleting, startDelete] = React.useTransition();

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return applicants;
    return applicants.filter((a) =>
      [a.name, a.email, ...a.software, ...a.specialties].some((value) => value.toLowerCase().includes(q)),
    );
  }, [applicants, query]);

  const decide = (applicant: PipelineApplicant, stage: Decision["stage"], position?: number) =>
    new Promise<boolean>((resolve) =>
      setDecision({
        applicant: { id: applicant.id, name: applicant.name, email: applicant.email, editorId: applicant.editorId },
        stage,
        position,
        resolve,
      }),
    );

  /** After a plain stage change: confirm, and offer to send the test at Test Edit Sent. */
  const afterStageChange = (applicant: PipelineApplicant, stage: ApplicantStage) => {
    toast.success(`${applicant.name} moved to ${applicantStageLabel(stage)}`);
    if (stage === "test_edit_sent" && !applicant.testEditUrl) setTestFor({ applicant, prompted: true });
  };

  // Dropping on Approved or Rejected waits for the confirmation; cancelling
  // puts the card back.
  const onMove = async (applicant: PipelineApplicant, column: string, position: number) => {
    const stage = column as ApplicantStage;
    if (isDecision(stage) && stage !== applicant.column) return decide(applicant, stage, position);

    const result = await moveApplicant(applicant.id, stage, position);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    if (stage !== applicant.column) afterStageChange(applicant, stage);
    return true;
  };

  const moveTo = async (applicant: PipelineApplicant, stage: ApplicantStage) => {
    if (isDecision(stage)) return void decide(applicant, stage);
    const result = await setApplicantStage(applicant.id, stage);
    if (!result.ok) return void toast.error(result.error);
    afterStageChange(applicant, stage);
    router.refresh();
  };

  const copyApplyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/apply`);
      toast.success("Application form link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const confirmDelete = () =>
    startDelete(async () => {
      if (!toDelete) return;
      const result = await deleteApplicant(toDelete.id);
      if (result.ok) {
        toast.success(`${toDelete.name}'s application deleted`);
        setToDelete(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, software, skills"
            aria-label="Search applicants"
            className="rounded-full bg-surface pl-9"
          />
        </div>
        <Button variant="secondary" onClick={copyApplyLink} className="ml-auto bg-surface ring-1 ring-border">
          <LinkIcon /> Application form link
        </Button>
      </div>

      <KanbanBoard
        ariaLabel="Applicant pipeline"
        columns={COLUMNS}
        items={visible}
        onMove={onMove}
        itemLabel={(applicant) => applicant.name}
        emptyText={query ? "No matches" : "Drag an applicant here"}
        renderCard={(applicant, { overlay }) => (
          <ApplicantCard
            applicant={applicant}
            today={today}
            overlay={overlay}
            menu={
              overlay ? null : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Actions for ${applicant.name}`}
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                    <DropdownMenuItem asChild>
                      <Link href={`/editors/applicants/${applicant.id}`}>
                        <ExternalLinkIcon /> Open applicant
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setTestFor({ applicant, prompted: false })}>
                      <SendIcon /> {applicant.testEditUrl ? "Resend test edit" : "Send test edit"}
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <ArrowRightIcon /> Move to
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="rounded-2xl">
                        {APPLICANT_STAGES.filter((s) => s.value !== applicant.column).map((stage) => (
                          <DropdownMenuItem key={stage.value} onSelect={() => void moveTo(applicant, stage.value)}>
                            <span className={`size-2 rounded-full ${stage.dot}`} /> {stage.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(applicant)}>
                      <Trash2Icon /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            }
          />
        )}
      />

      <DecisionDialog
        decision={decision}
        onDone={(ok) => {
          decision?.resolve?.(ok);
          setDecision(null);
        }}
      />

      {testFor && (
        <SendTestDialog
          open
          onOpenChange={(open) => !open && setTestFor(null)}
          applicant={{
            id: testFor.applicant.id,
            name: testFor.applicant.name,
            email: testFor.applicant.email,
            testEditUrl: testFor.applicant.testEditUrl,
          }}
          defaultUrl={lastTestEditUrl}
          title={testFor.prompted ? `Send ${testFor.applicant.name} the test edit?` : undefined}
          description={
            testFor.prompted
              ? "They're at Test Edit Sent. Email them the brief now, with a personal link to send their edit back."
              : undefined
          }
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}&apos;s application?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the application, notes and rating. It can&apos;t be undone.
              {toDelete?.editorId && " Their editor account stays."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              Delete application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
