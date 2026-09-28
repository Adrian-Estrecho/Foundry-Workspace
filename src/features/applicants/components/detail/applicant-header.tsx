"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, MoreHorizontalIcon, SendIcon, Trash2Icon } from "lucide-react";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { deleteApplicant, setApplicantStage } from "../../actions";
import { APPLICANT_STAGES, applicantStageLabel, type ApplicantStage } from "../../constants";
import { DecisionDialog, type Decision } from "../decision-dialog";
import { SendTestDialog } from "../send-test-dialog";

type Applicant = {
  id: string;
  name: string;
  email: string;
  stage: ApplicantStage;
  editorId: string | null;
  testEditUrl: string | null;
  appliedLabel: string;
};

export function ApplicantHeader({ applicant, lastTestEditUrl }: { applicant: Applicant; lastTestEditUrl: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [decision, setDecision] = React.useState<Decision | null>(null);
  const [testOpen, setTestOpen] = React.useState(false);
  const [testPrompt, setTestPrompt] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const current = APPLICANT_STAGES.find((s) => s.value === applicant.stage)!;
  const person = { id: applicant.id, name: applicant.name, email: applicant.email, editorId: applicant.editorId };

  const changeStage = (stage: ApplicantStage) => {
    if (stage === "approved" || stage === "rejected") return setDecision({ applicant: person, stage });
    startTransition(async () => {
      const result = await setApplicantStage(applicant.id, stage);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Moved to ${applicantStageLabel(stage)}`);
      if (stage === "test_edit_sent" && !applicant.testEditUrl) {
        setTestPrompt(true);
        setTestOpen(true);
      }
      router.refresh();
    });
  };

  const remove = () =>
    startTransition(async () => {
      const result = await deleteApplicant(applicant.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${applicant.name}'s application deleted`);
      router.push("/editors/applicants");
    });

  return (
    <div className="mb-6">
      <Link href="/editors/applicants" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Applicants
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-3xl font-semibold tracking-tight">{applicant.name}</h1>
          <p className="mt-1 text-muted-foreground">
            <a href={`mailto:${applicant.email}`} className="hover:text-foreground">
              {applicant.email}
            </a>{" "}
            · {applicant.appliedLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="lg" className="bg-surface ring-1 ring-border" disabled={pending}>
                <span className={cn("size-2.5 rounded-full", current.dot)} />
                {current.label}
                <ChevronDownIcon className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              <DropdownMenuLabel>Pipeline stage</DropdownMenuLabel>
              {APPLICANT_STAGES.map((stage) => (
                <DropdownMenuItem key={stage.value} onSelect={() => stage.value !== applicant.stage && changeStage(stage.value)}>
                  <span className={cn("size-2 rounded-full", stage.dot)} />
                  {stage.label}
                  {stage.value === applicant.stage && <CheckIcon className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-lg" aria-label="More actions">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem
                onSelect={() => {
                  setTestPrompt(false);
                  setTestOpen(true);
                }}
              >
                <SendIcon /> {applicant.testEditUrl ? "Resend test edit" : "Send test edit"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2Icon /> Delete application
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DecisionDialog decision={decision} onDone={() => setDecision(null)} />

      <SendTestDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        applicant={{ id: applicant.id, name: applicant.name, email: applicant.email, testEditUrl: applicant.testEditUrl }}
        defaultUrl={lastTestEditUrl}
        title={testPrompt ? `Send ${applicant.name} the test edit?` : undefined}
        description={
          testPrompt ? "They're at Test Edit Sent. Email them the brief now, with a personal link to send their edit back." : undefined
        }
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {applicant.name}&apos;s application?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the application, notes and rating. It can&apos;t be undone.
              {applicant.editorId && " Their editor account stays."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                remove();
              }}
            >
              Delete application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
