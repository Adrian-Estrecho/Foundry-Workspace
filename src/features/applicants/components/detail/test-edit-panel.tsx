"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CopyIcon, FilmIcon, FolderOpenIcon, Loader2Icon, PencilIcon, SendIcon } from "lucide-react";
import { FormRow, submitWith } from "@/components/shared/form";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateTestLinks } from "../../actions";
import type { ApplicantStage } from "../../constants";
import { SendTestDialog } from "../send-test-dialog";

export function TestEditPanel({
  applicant,
  submitLink,
  lastTestEditUrl,
}: {
  applicant: {
    id: string;
    name: string;
    email: string;
    stage: ApplicantStage;
    testEditUrl: string | null;
    testSubmissionUrl: string | null;
  };
  submitLink: string;
  lastTestEditUrl: string | null;
}) {
  const router = useRouter();
  const [sendOpen, setSendOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await updateTestLinks(applicant.id, formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success("Links saved");
      setErrors({});
      setEditing(false);
      router.refresh();
    });

  const copySubmitLink = async () => {
    try {
      await navigator.clipboard.writeText(submitLink);
      toast.success("Submission link copied", { description: `Send it to ${applicant.name} if they lost the email.` });
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  return (
    <Panel
      title="Test edit"
      description={
        applicant.testSubmissionUrl
          ? "Their edit is in."
          : applicant.testEditUrl
            ? "Sent. Waiting for their edit."
            : "Not sent yet."
      }
      action={
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing((v) => !v)} aria-label="Edit test links">
            <PencilIcon />
          </Button>
          <Button size="sm" onClick={() => setSendOpen(true)}>
            <SendIcon /> {applicant.testEditUrl ? "Resend" : "Send test edit"}
          </Button>
        </div>
      }
    >
      {editing ? (
        <form onSubmit={submitWith(save)} className="grid gap-4">
          <FormRow label="Test brief and footage" error={errors.test_edit_url}>
            <Input name="test_edit_url" type="url" defaultValue={applicant.testEditUrl ?? ""} placeholder="https://" />
          </FormRow>
          <FormRow
            label="Their edit"
            hint="Add it here if they sent it by email. They'll move to Test Submitted."
            error={errors.test_submission_url}
          >
            <Input name="test_submission_url" type="url" defaultValue={applicant.testSubmissionUrl ?? ""} placeholder="https://" />
          </FormRow>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Save links
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          <LinkRow icon={FolderOpenIcon} label="Brief and footage" href={applicant.testEditUrl} empty="No test brief yet" />
          <LinkRow
            icon={FilmIcon}
            label="Their edit"
            href={applicant.testSubmissionUrl}
            empty={applicant.testEditUrl ? "Not submitted yet" : "—"}
            highlight
          />
          {(applicant.stage === "test_edit_sent" || applicant.stage === "test_submitted") && (
            <button
              type="button"
              onClick={copySubmitLink}
              className="mt-1 inline-flex items-center gap-1.5 justify-self-start text-xs text-muted-foreground hover:text-foreground"
            >
              <CopyIcon className="size-3.5" /> Copy their personal submission link
            </button>
          )}
        </div>
      )}

      <SendTestDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        applicant={{ id: applicant.id, name: applicant.name, email: applicant.email, testEditUrl: applicant.testEditUrl }}
        defaultUrl={lastTestEditUrl}
      />
    </Panel>
  );
}

function LinkRow({
  icon: Icon,
  label,
  href,
  empty,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string | null;
  empty: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${
          href && highlight ? "bg-primary/12 text-primary ring-primary/25" : "bg-muted text-muted-foreground ring-border"
        }`}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:text-primary">
            {href.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <span className="block text-sm text-muted-foreground">{empty}</span>
        )}
      </span>
    </div>
  );
}
