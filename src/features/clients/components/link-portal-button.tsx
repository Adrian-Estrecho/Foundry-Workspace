"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlobeIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CopyLinkField } from "@/features/portal/components/portal-admin";
import { timeAgo } from "@/lib/dates";
import { closeLinkPortal, openLinkPortal, resetLinkPortal } from "../link-portal-actions";

export type LinkPortalInfo = { token: string; enabled: boolean; lastViewedAt: string | null } | null;

/**
 * On Clients → Links: the private link to the same links without logging
 * in. Admins create it, copy it, replace it (the old link stops working) or
 * turn it off.
 */
export function LinkPortalButton({ portal, siteUrl, renderedAt }: { portal: LinkPortalInfo; siteUrl: string; renderedAt: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.error ?? "Something went wrong.");
      toast.success(success);
      after?.();
      router.refresh();
    });

  const on = portal?.enabled ?? false;

  return (
    <>
      <Button variant={on ? "secondary" : "default"} onClick={() => setOpen(true)}>
        <GlobeIcon /> Share link
        {on && (
          <>
            <span aria-hidden="true" className="size-2 rounded-full bg-success" />
            <span className="sr-only"> (on)</span>
          </>
        )}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmReset(false);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Share every client&apos;s links</DialogTitle>
            <DialogDescription>
              One page with each client&apos;s Frame.io and Drive links, to open or copy. No login: whoever has the link can see every
              client&apos;s links, so share it only with people you trust.
            </DialogDescription>
          </DialogHeader>

          {on && portal ? (
            <div className="grid gap-2">
              <CopyLinkField url={`${siteUrl}/links/${portal.token}`} label="Links portal link" />
              <p className="text-xs text-muted-foreground">
                {portal.lastViewedAt ? `Last opened ${timeAgo(portal.lastViewedAt, renderedAt)}` : "Not opened yet"}
              </p>
            </div>
          ) : portal ? (
            <p className="text-sm text-muted-foreground">The link is off, so it doesn&apos;t open. Turning it back on keeps the same link.</p>
          ) : null}

          {confirmReset && (
            <p className="rounded-lg bg-warning/10 p-3 text-sm ring-1 ring-warning/30">
              The current link stops working straight away. Use this if it reached someone it shouldn&apos;t have, then share the new one.
            </p>
          )}

          <DialogFooter>
            {!on ? (
              <>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => run(openLinkPortal, portal ? "Link is back on" : "Link created")} disabled={pending}>
                  {pending ? <Loader2Icon className="animate-spin" /> : <GlobeIcon />}
                  {portal ? "Turn back on" : "Create link"}
                </Button>
              </>
            ) : confirmReset ? (
              <>
                <Button variant="ghost" onClick={() => setConfirmReset(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button
                  onClick={() => run(resetLinkPortal, "New link ready. The old one no longer works.", () => setConfirmReset(false))}
                  disabled={pending}
                >
                  {pending && <Loader2Icon className="animate-spin" />}
                  Make a new link
                </Button>
              </>
            ) : (
              <>
                <Button variant="destructive" onClick={() => run(closeLinkPortal, "Link turned off")} disabled={pending} className="sm:mr-auto">
                  Turn off
                </Button>
                <Button variant="secondary" onClick={() => setConfirmReset(true)} disabled={pending}>
                  <RefreshCwIcon /> Make a new link
                </Button>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
