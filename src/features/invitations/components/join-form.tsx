"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertCircleIcon, ArrowRightIcon, Loader2Icon, TicketIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceTile } from "@/features/workspaces/components/workspace-switcher";
import { acceptInvitation, previewInvitation, type InvitationPreview } from "../actions";

/** Keeps what's typed looking like a code: XXXX-XXXX-XXXX. */
function formatTyped(value: string) {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return clean.match(/.{1,4}/g)?.join("-") ?? "";
}

const PREVIEW_ERRORS: Partial<Record<InvitationPreview["status"], string>> = {
  expired: "This invitation has expired. Ask the team to send you a new one.",
  revoked: "This invitation was withdrawn. Ask the team if you think that's a mistake.",
  used: "This invitation has already been used.",
  not_found: "That code doesn't match an invitation. Check it and try again.",
  rate_limited: "Too many wrong codes. Wait 15 minutes and try again.",
};

/**
 * Enter an invitation code, see which team it's for, then join. Joining
 * opens the Onboarding page.
 */
export function JoinForm({ initialCode = "", accountEmail }: { initialCode?: string; accountEmail: string }) {
  const [code, setCode] = React.useState(formatTyped(initialCode));
  const [preview, setPreview] = React.useState<InvitationPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [checking, startCheck] = React.useTransition();
  const [joining, startJoin] = React.useTransition();

  const check = React.useCallback(
    (value: string) =>
      startCheck(async () => {
        setError(null);
        const result = await previewInvitation(value);
        if (!result.ok) return setError(result.error);
        const message = PREVIEW_ERRORS[result.data.status];
        if (message) return setError(message);
        setPreview(result.data);
      }),
    [],
  );

  // Arrived from the email link: look the code up straight away.
  const linkCode = React.useRef(formatTyped(initialCode));
  React.useEffect(() => {
    if (linkCode.current.replace(/-/g, "").length === 12) check(linkCode.current);
  }, [check]);

  const join = () =>
    startJoin(async () => {
      const result = await acceptInvitation(code);
      if (result && !result.ok) {
        toast.error(result.error);
        setPreview(null);
        setError(result.error);
      }
    });

  if (preview) {
    const member = preview.status === "member";
    return (
      <div className="grid gap-4">
        <div className="flex items-center gap-3 rounded-lg bg-surface p-4 ring-1 ring-border">
          <WorkspaceTile name={preview.workspaceName ?? "?"} className="size-10 text-base" />
          <div className="min-w-0">
            <p className="truncate font-medium">{preview.workspaceName}</p>
            <p className="text-sm text-muted-foreground">
              {member ? "You're already in this workspace" : `Editor${preview.invitedBy ? ` · invited by ${preview.invitedBy}` : ""}`}
            </p>
          </div>
        </div>
        {preview.sentTo && !member && (
          <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-sm text-warning ring-1 ring-warning/25">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              This invitation was sent to {preview.sentTo}, and you&apos;re signed in as {accountEmail}. You can still accept it
              with this account.
            </span>
          </p>
        )}
        {!member && (
          <p className="text-sm text-muted-foreground">
            You&apos;ll start with onboarding: a few setup steps, a short test edit and an interview. The rest of the workspace
            opens once they approve you.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={join} disabled={joining}>
            {joining ? <Loader2Icon className="animate-spin" /> : <ArrowRightIcon />}
            {member ? "Open workspace" : `Join ${preview.workspaceName}`}
          </Button>
          <Button variant="ghost" onClick={() => setPreview(null)} disabled={joining}>
            Use another code
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        check(code);
      }}
      className="grid gap-3"
    >
      <label className="grid gap-2">
        <span className="text-sm font-medium">Invitation code</span>
        <div className="relative">
          <TicketIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="code"
            value={code}
            onChange={(event) => {
              setCode(formatTyped(event.target.value));
              setError(null);
            }}
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-11 bg-surface pl-9 font-mono tracking-wider"
            aria-invalid={!!error}
            required
          />
        </div>
      </label>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={checking || code.replace(/-/g, "").length < 12} className="ring-1 ring-border">
        {checking && <Loader2Icon className="animate-spin" />}
        Continue
      </Button>
    </form>
  );
}
