"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SparklesIcon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { toggleEditorChecklistItem } from "../../actions";
import { AUTO_STEP_HINTS } from "../../constants";

type Item = { id: string; key: string; label: string; is_done: boolean; done_at: string | null };

/** The editor's onboarding steps. Admins can tick or untick any of them by hand. */
export function OnboardingPanel({
  items,
  completedAt,
  renderedAt,
}: {
  items: Item[];
  completedAt: string | null;
  renderedAt: number;
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = React.useOptimistic(
    items,
    (current, { id, done }: { id: string; done: boolean }) =>
      current.map((item) => (item.id === id ? { ...item, is_done: done } : item)),
  );
  const [, startTransition] = React.useTransition();

  const toggle = (item: Item, done: boolean) =>
    startTransition(async () => {
      setOptimistic({ id: item.id, done });
      const result = await toggleEditorChecklistItem(item.id, done);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });

  const done = optimistic.filter((item) => item.is_done).length;
  const percent = items.length ? (done / items.length) * 100 : 0;

  return (
    <Panel
      title="Onboarding"
      description={completedAt ? `Finished ${timeAgo(completedAt, renderedAt)}` : `${done} of ${items.length} done`}
      action={
        <span
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium ring-1 tabular",
            done === items.length ? "bg-success/12 text-success ring-success/25" : "bg-surface-strong ring-border",
          )}
        >
          {Math.round(percent)}%
        </span>
      }
    >
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn("h-full rounded-full transition-all", done === items.length ? "bg-success" : "bg-primary")}
          style={{ width: `${percent}%` }}
        />
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {optimistic.map((item) => {
          const hint = AUTO_STEP_HINTS[item.key];
          return (
            <li key={item.id}>
              <label
                className={cn(
                  "flex h-full cursor-pointer items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border transition-colors hover:bg-accent/40",
                  item.is_done && "bg-success/5",
                )}
              >
                <Checkbox
                  checked={item.is_done}
                  onCheckedChange={(checked) => toggle(item, checked === true)}
                  className="size-5 rounded-md"
                />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-medium", item.is_done && "text-muted-foreground")}>{item.label}</span>
                  {item.is_done && item.done_at && (
                    <span className="block text-xs text-muted-foreground">Done {timeAgo(item.done_at, renderedAt)}</span>
                  )}
                </span>
                {hint && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground" aria-label={hint}>
                        <SparklesIcon className="size-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{hint}</TooltipContent>
                  </Tooltip>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
