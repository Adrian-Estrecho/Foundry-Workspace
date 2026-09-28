"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpenIcon, CheckCircle2Icon, CheckIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SOP_CATEGORY_LABEL } from "@/features/sops/constants";
import { SopContent } from "@/features/sops/components/sop-content";
import { timeAgo } from "@/lib/dates";
import type { Enums, Json } from "@/types/database";
import { acknowledgeSop } from "../../onboarding-actions";

type Sop = { id: string; title: string; category: Enums<"sop_category">; content: Json; acknowledgedAt: string | null };

export function SopsStep({ sops, renderedAt }: { sops: Sop[]; renderedAt: number }) {
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
      const next = sops.find((s) => s.id !== sop.id && !s.acknowledgedAt);
      setOpenId(next?.id ?? null);
      router.refresh();
    });

  if (sops.length === 0) {
    return <p className="text-sm text-muted-foreground">There are no required SOPs right now.</p>;
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
              <span className="block truncate text-sm font-medium">{sop.title}</span>
              <span className="block text-xs text-muted-foreground">
                {SOP_CATEGORY_LABEL[sop.category]}
                {sop.acknowledgedAt && ` · Read ${timeAgo(sop.acknowledgedAt, renderedAt)}`}
              </span>
            </span>
            <Button size="sm" variant={sop.acknowledgedAt ? "ghost" : "default"} onClick={() => setOpenId(sop.id)}>
              {sop.acknowledgedAt ? "Open" : "Read"}
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={!!open} onOpenChange={(value) => !value && setOpenId(null)}>
        {open && (
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">{open.title}</DialogTitle>
              <DialogDescription>{SOP_CATEGORY_LABEL[open.category]}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[55vh] pr-3">
              <SopContent content={open.content} />
            </ScrollArea>
            <DialogFooter>
              {open.acknowledgedAt ? (
                <Button variant="ghost" onClick={() => setOpenId(null)}>
                  Close
                </Button>
              ) : (
                <Button onClick={() => acknowledge(open)} disabled={pending}>
                  {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} I&apos;ve read and understood this
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
