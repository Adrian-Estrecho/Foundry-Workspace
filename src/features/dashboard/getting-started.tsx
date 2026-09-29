"use client";

import Link from "next/link";
import { toast } from "sonner";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SetupProgress = {
  applyUrl: string;
  intakeUrl: string;
  hasApplicants: boolean;
  hasOnboardingLinks: boolean;
  hasTestEdit: boolean;
  hasClients: boolean;
};

/** First steps for a new workspace. Hidden once they're all done. */
export function GettingStarted({ setup }: { setup: SetupProgress }) {
  const copy = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} link copied`);
    } catch {
      toast.error("Couldn't copy. Your browser blocked clipboard access.");
    }
  };

  const steps = [
    {
      done: setup.hasOnboardingLinks,
      title: "Add your onboarding links",
      text: "Contract and NDA, Frame.io invite and asset pack, for new editors.",
      action: (
        <Button asChild size="sm" variant="secondary" className="bg-surface ring-1 ring-border">
          <Link href="/settings">Open settings</Link>
        </Button>
      ),
    },
    {
      done: setup.hasTestEdit,
      title: "Write your test edit",
      text: "Every editor who joins gets it straight away.",
      action: (
        <Button asChild size="sm" variant="secondary" className="bg-surface ring-1 ring-border">
          <Link href="/settings#hiring">Set it up</Link>
        </Button>
      ),
    },
    {
      done: setup.hasApplicants,
      title: "Share your application link",
      text: "Editors apply there. Invite the ones you like to join.",
      action: (
        <Button size="sm" variant="secondary" className="bg-surface ring-1 ring-border" onClick={() => copy(setup.applyUrl, "Application")}>
          <CopyIcon /> Copy link
        </Button>
      ),
    },
    {
      done: setup.hasClients,
      title: "Bring in your first client",
      text: "Share your project form, or add a client yourself.",
      action: (
        <Button size="sm" variant="secondary" className="bg-surface ring-1 ring-border" onClick={() => copy(setup.intakeUrl, "Project form")}>
          <CopyIcon /> Copy link
        </Button>
      ),
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <Panel title="Getting started" description={`${doneCount} of ${steps.length} done`} className="mb-5">
      <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3 rounded-lg bg-surface p-3 ring-1 ring-border">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ring-1 tabular",
                step.done ? "bg-success/15 text-success ring-success/30" : "bg-muted text-muted-foreground ring-border",
              )}
            >
              {step.done ? <CheckIcon className="size-3.5" /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-medium", step.done && "text-muted-foreground line-through")}>{step.title}</span>
              <span className="block text-xs text-muted-foreground">{step.text}</span>
            </span>
            {!step.done && <span className="shrink-0">{step.action}</span>}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
