"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpenIcon, CheckCircle2Icon, CheckIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SopWorkspace } from "@/features/sops/components/sop-document";
import { SopReader } from "@/features/sops/components/sop-reader";
import { SOP_CATEGORY_LABEL } from "@/features/sops/constants";
import { timeAgo } from "@/lib/dates";
import type { Enums, Json } from "@/types/database";
import { acknowledgeSop } from "../../onboarding-actions";

type Sop = {
  id: string;
  title: string;
  category: Enums<"sop_category">;
  content: Json;
  acknowledgedAt: string | null;
  /** Shown as a tag in the SOP library (everything in onboarding is required). */
  required?: boolean;
  updatedAt?: string;
};

/**
 * SOPs to open and read. Editors mark each as read ("acknowledge"); admins
 * (`canAcknowledge` false) just read them.
 */
export function SopsStep({
  sops,
  workspace,
  renderedAt,
  canAcknowledge = true,
  emptyText = "There are no required SOPs right now.",
}: {
  sops: Sop[];
  workspace: SopWorkspace;
  renderedAt: number;
  canAcknowledge?: boolean;
  emptyText?: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const open = sops.find((sop) => sop.id === openId) ?? null;

  const acknowledge = (sop: Sop) =>
    startTransition(async () => {
      const result = await acknowledgeSop(sop.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Marked “${sop.title}” as read`);
      // Open the next one still to read, if any.
      const next = sops.find((s) => s.id !== sop.id && !s.acknowledgedAt && s.required !== false);
      setOpenId(next?.id ?? null);
      router.refresh();
    });

  if (sops.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-2">
        {sops.map((sop) => (
          <li key={sop.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border">
            <span
              className={
                sop.acknowledgedAt
                  ? "grid size-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success ring-1 ring-success/25"
                  : "grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border"
              }
            >
              {sop.acknowledgedAt ? <CheckCircle2Icon className="size-5" /> : <BookOpenIcon className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{sop.title}</span>
                {sop.required && (
                  <span className="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">Required</span>
                )}
              </span>
              <span className="block text-xs text-muted-foreground">
                {SOP_CATEGORY_LABEL[sop.category]}
                {sop.acknowledgedAt && ` · Read ${timeAgo(sop.acknowledgedAt, renderedAt)}`}
              </span>
            </span>
            <Button
              size="sm"
              variant={sop.acknowledgedAt || !canAcknowledge ? "ghost" : "default"}
              onClick={() => setOpenId(sop.id)}
            >
              {sop.acknowledgedAt || !canAcknowledge ? "Open" : "Read"}
            </Button>
          </li>
        ))}
      </ul>

      <SopReader
        sop={open}
        workspace={workspace}
        onClose={() => setOpenId(null)}
        status={open?.acknowledgedAt ? `Read ${timeAgo(open.acknowledgedAt, renderedAt)}` : undefined}
        actions={
          open && (open.acknowledgedAt || !canAcknowledge) ? (
            <Button variant="ghost" onClick={() => setOpenId(null)}>
              Close
            </Button>
          ) : (
            <Button onClick={() => open && acknowledge(open)} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} I&apos;ve read and understood this
            </Button>
          )
        }
      />
    </>
  );
}
