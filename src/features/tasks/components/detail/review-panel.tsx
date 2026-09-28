"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { firstName } from "@/lib/utils";
import { reviewTask } from "../../actions";

/** Shown to admins while a task is in For Review: approve it, or send it back with feedback. */
export function ReviewPanel({ taskId, editorName }: { taskId: string; editorName: string | null }) {
  const router = useRouter();
  const [feedback, setFeedback] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const who = editorName ? firstName(editorName) : "The editor";

  const review = (decision: "done" | "revisions") =>
    startTransition(async () => {
      const result = await reviewTask(taskId, decision, feedback);
      if (!result.ok) return void toast.error(result.error);
      toast.success(decision === "done" ? "Approved and marked Done" : "Revisions requested", {
        description: decision === "done" ? undefined : `${who} has been notified with your feedback.`,
      });
      setFeedback("");
      router.refresh();
    });

  return (
    <Panel
      title="Ready for review"
      description={`${who} handed this in. Check the links below, then approve it or ask for changes.`}
      className="border-warning/40"
    >
      <div className="grid gap-3">
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          placeholder="Feedback (required to request revisions; optional when approving)"
          aria-label="Review feedback"
          className="rounded-xl"
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => review("done")} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Approve
          </Button>
          <Button variant="outline" onClick={() => review("revisions")} disabled={pending || !feedback.trim()}>
            <RotateCcwIcon /> Request revisions
          </Button>
        </div>
      </div>
    </Panel>
  );
}
