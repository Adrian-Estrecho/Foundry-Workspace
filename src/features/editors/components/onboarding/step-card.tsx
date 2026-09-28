import * as React from "react";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** One onboarding step: number (or tick), title, what to do, then the controls. */
export function StepCard({
  number,
  title,
  description,
  done,
  current,
  autoHint,
  id,
  children,
}: {
  number: number;
  title: string;
  description: React.ReactNode;
  done: boolean;
  /** The first step still to do gets a subtle highlight. */
  current?: boolean;
  /** Shown for steps that tick themselves. */
  autoHint?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={`Step ${number}: ${title}${done ? " (done)" : ""}`}
      className={cn("scroll-mt-20 rounded-xl border bg-card", current && "border-primary/45")}
    >
      <header className="flex items-start gap-4 p-5 pb-4">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ring-1 tabular",
            done
              ? "bg-success/15 text-success ring-success/30"
              : current
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-muted text-muted-foreground ring-border",
          )}
        >
          {done ? <CheckIcon className="size-4" /> : number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-medium">{title}</h2>
          <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>
        </div>
        {done ? (
          <span className="rounded-full bg-success/12 px-2.5 py-0.5 text-xs font-medium text-success ring-1 ring-success/25">Done</span>
        ) : (
          autoHint && (
            <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex" title={autoHint}>
              <SparklesIcon className="size-3.5" /> Ticks itself
            </span>
          )
        )}
      </header>
      <div className="px-5 pb-5 sm:pl-17">{children}</div>
    </section>
  );
}
