import { CalendarPlusIcon, VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Enums } from "@/types/database";
import { interviewTime } from "../../interview";

type Interview = {
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  note_to_editor: string | null;
  outcome: Enums<"interview_outcome">;
};

/** The editor's side of the interview: when, where, and how it went. */
export function InterviewStep({
  interview,
  timeZone,
  workspaceName,
}: {
  interview: Interview | null;
  timeZone: string;
  workspaceName: string;
}) {
  if (!interview) {
    return (
      <p className="text-sm text-muted-foreground">
        {workspaceName} will book a short call with you, usually after your test edit. The time and meeting link will appear
        here, and you&apos;ll get an email.
      </p>
    );
  }

  if (interview.outcome === "passed") {
    return <p className="text-sm text-muted-foreground">You passed your interview. Nice work.</p>;
  }
  if (interview.outcome === "failed") {
    return (
      <p className="text-sm text-muted-foreground">
        This one didn&apos;t work out. {workspaceName} will be in touch about what happens next.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-lg bg-surface p-4 ring-1 ring-border">
        <p className="font-medium">{interviewTime(interview.scheduled_at, timeZone)}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {interview.duration_minutes} minutes · your time ({timeZone.replace(/_/g, " ")})
        </p>
        {interview.note_to_editor && (
          <p className="mt-3 text-sm whitespace-pre-line">{interview.note_to_editor}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {interview.meeting_url && (
          <Button asChild>
            <a href={interview.meeting_url} target="_blank" rel="noreferrer">
              <VideoIcon /> Join the call
            </a>
          </Button>
        )}
        <Button asChild variant="secondary" className="bg-surface ring-1 ring-border">
          <a href="/onboarding/interview.ics" download>
            <CalendarPlusIcon /> Add to calendar
          </a>
        </Button>
      </div>
    </div>
  );
}
