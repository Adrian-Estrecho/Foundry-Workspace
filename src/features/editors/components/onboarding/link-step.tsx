"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, ExternalLinkIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setOnboardingStep } from "../../onboarding-actions";

/** A step ReEdit can't verify: open the link, then say it's done. */
export function LinkStep({
  stepKey,
  done,
  href,
  openLabel,
  doneLabel,
  missingText,
}: {
  stepKey: "frameio" | "asset_pack";
  done: boolean;
  href: string | null;
  openLabel: string;
  doneLabel: string;
  missingText: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const set = (value: boolean) =>
    startTransition(async () => {
      const result = await setOnboardingStep(stepKey, value);
      if (!result.ok) return void toast.error(result.error);
      if (value) toast.success("Step done");
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {href ? (
        <Button asChild variant={done ? "outline" : "secondary"} className={done ? undefined : "bg-surface ring-1 ring-border"}>
          <a href={href} target="_blank" rel="noreferrer">
            <ExternalLinkIcon /> {openLabel}
          </a>
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">{missingText}</p>
      )}
      {done ? (
        <Button variant="ghost" size="sm" onClick={() => set(false)} disabled={pending} className="text-muted-foreground">
          {pending ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />} Mark as not done
        </Button>
      ) : (
        <Button onClick={() => set(true)} disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} {doneLabel}
        </Button>
      )}
    </div>
  );
}
