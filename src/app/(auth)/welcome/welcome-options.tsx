"use client";

import * as React from "react";
import { ArrowRightIcon, PlusIcon, TicketIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JoinForm } from "@/features/invitations/components/join-form";
import { CreateWorkspaceForm } from "@/features/workspaces/components/create-workspace-form";

type Option = "join" | "create";

/**
 * The two ways in: join a team with an invitation code, or start your own
 * workspace. Each opens its form in a dialog. Arriving from an invitation
 * link (?code=…) opens the join dialog straight away.
 */
export function WelcomeOptions({
  initialCode,
  accountEmail,
  host,
}: {
  initialCode: string;
  accountEmail: string;
  host: string;
}) {
  const [open, setOpen] = React.useState<Option | null>(initialCode ? "join" : null);
  const close = (next: boolean) => {
    if (!next) setOpen(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <OptionCard
          title="Join a team"
          text="Got an invitation? Enter the code from the email and start onboarding."
          action="Enter your code"
          art={<TicketArt />}
          onSelect={() => setOpen("join")}
        />
        <OptionCard
          title="Start your own workspace"
          text="Run your own editing team: clients, projects, hiring and onboarding."
          action="Set it up"
          art={<WorkspaceArt />}
          onSelect={() => setOpen("create")}
        />
      </div>

      <Dialog open={open === "join"} onOpenChange={close}>
        <DialogContent className="gap-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Join a team</DialogTitle>
            <DialogDescription>Enter the invitation code from your email to see which team it&apos;s for.</DialogDescription>
          </DialogHeader>
          <JoinForm initialCode={initialCode} accountEmail={accountEmail} />
        </DialogContent>
      </Dialog>

      <Dialog open={open === "create"} onOpenChange={close}>
        <DialogContent className="gap-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Set up your workspace</DialogTitle>
            <DialogDescription>You&apos;ll be its owner. You can rename it and change its link later in Settings.</DialogDescription>
          </DialogHeader>
          <CreateWorkspaceForm host={host} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function OptionCard({
  title,
  text,
  action,
  art,
  onSelect,
}: {
  title: string;
  text: string;
  action: string;
  art: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <div className="group relative flex flex-col rounded-xl bg-surface p-3 ring-1 ring-border transition-colors hover:bg-surface-strong hover:ring-primary/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
      <div className="grid h-32 place-items-center overflow-hidden rounded-lg bg-background ring-1 ring-border">{art}</div>
      <div className="flex flex-1 flex-col px-1 pt-4 pb-1">
        <h2 className="font-heading text-base font-medium">
          {/* Stretched over the whole card, so the card is one big button. */}
          <button type="button" onClick={onSelect} className="outline-none after:absolute after:inset-0 after:rounded-xl">
            {title}
          </button>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-primary">
          {action}
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </div>
  );
}

/** An invitation ticket with its code. */
function TicketArt() {
  return (
    <div className="relative flex items-center gap-3 rounded-lg bg-primary/12 py-3 pr-5 pl-4 text-primary ring-1 ring-primary/35 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
      <TicketIcon className="size-5" />
      <span className="h-8 border-l border-dashed border-primary/40" />
      <span className="font-mono text-sm font-medium tracking-wider">TEAM·····</span>
      {/* Punched notches */}
      <span className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full bg-background ring-1 ring-primary/35 [clip-path:inset(0_0_0_50%)]" />
      <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-background ring-1 ring-primary/35 [clip-path:inset(0_50%_0_0)]" />
    </div>
  );
}

/** A small, empty workspace waiting for its first project. */
function WorkspaceArt() {
  return (
    <div className="flex h-20 w-44 overflow-hidden rounded-lg bg-card ring-1 ring-border transition-transform duration-300 group-hover:scale-105">
      <div className="grid w-11 content-start gap-1.5 border-r bg-sidebar p-2">
        <span className="size-3 rounded-[3px] bg-primary" />
        <span className="h-1 rounded-full bg-muted-foreground/30" />
        <span className="h-1 w-4/5 rounded-full bg-muted-foreground/30" />
        <span className="h-1 w-3/5 rounded-full bg-muted-foreground/30" />
      </div>
      <div className="grid flex-1 grid-cols-3 gap-1.5 p-2">
        {[0, 1, 2].map((column) => (
          <div key={column} className="grid content-start gap-1.5">
            <span className="h-1 w-2/3 rounded-full bg-muted-foreground/30" />
            {column === 0 ? (
              <span className="grid h-7 place-items-center rounded-[4px] border border-dashed border-primary/50 text-primary transition-colors group-hover:bg-primary/15">
                <PlusIcon className="size-3.5" />
              </span>
            ) : (
              <span className="h-7 rounded-[4px] bg-surface ring-1 ring-border" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
