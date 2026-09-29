import { CheckCircle2Icon, HourglassIcon, RotateCcwIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

/**
 * Where the test edit stands with the reviewers: not handed in, waiting for
 * review, changes requested (the feedback is in the test edit's thread), or
 * passed.
 */
export function ReviewStatus({ status, workspaceName }: { status: Enums<"task_status"> | null; workspaceName: string }) {
  const state =
    status === "done"
      ? { icon: CheckCircle2Icon, tone: "text-success", text: `${workspaceName} passed your test edit.` }
      : status === "for_review"
        ? { icon: HourglassIcon, tone: "text-warning", text: `${workspaceName} is reviewing your edit. You'll get a notification when they're done.` }
        : status === "revisions"
          ? {
              icon: RotateCcwIcon,
              tone: "text-danger",
              text: "They've asked for some changes. Their feedback is in your test edit above; send a new version when you're ready.",
            }
          : null;

  if (!state) {
    return <p className="text-sm text-muted-foreground">Once you hand in your test edit, its review shows up here.</p>;
  }
  const Icon = state.icon;
  return (
    <p className="flex items-start gap-2 text-sm">
      <Icon className={cn("mt-0.5 size-4 shrink-0", state.tone)} />
      <span>{state.text}</span>
    </p>
  );
}
