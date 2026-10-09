"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon, CopyIcon, ExternalLinkIcon, Loader2Icon, PlayIcon, PlusIcon, SendIcon, XIcon } from "lucide-react";
import { FormRow, submitWith } from "@/components/shared/form";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ClickUpMark } from "@/features/clickup/components/clickup-mark";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { addEditedVideo, removeAttachment } from "../../actions";
import type { Attachment } from "./attachments-panel";

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * The edit itself: each link sent here is the next version (v1, v2, …), and
 * the newest shows on the task's card. On a synced task it's posted in
 * ClickUp too, and an editor's "Edited: <link>" comment in ClickUp lands here.
 */
export function EditedVideoPanel({
  taskId,
  videos,
  canAdd,
  prompt,
  currentUserId,
  canRemoveAny,
  synced,
  renderedAt,
}: {
  taskId: string;
  /** Newest first. */
  videos: (Attachment & { version: number | null })[];
  canAdd: boolean;
  /** Show the form while there's no version yet (the editor doing the work). */
  prompt: boolean;
  currentUserId: string;
  canRemoveAny: boolean;
  synced: boolean;
  renderedAt: number;
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const [latest, ...earlier] = videos;
  const next = (latest?.version ?? 0) + 1;
  const showForm = canAdd && (adding || (!latest && prompt));

  const send = (formData: FormData) =>
    startTransition(async () => {
      const result = await addEditedVideo(taskId, formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success(`Version ${result.data?.version ?? next} sent`, {
        description: synced ? "It's on the task card, and posted in ClickUp." : "It's on the task card now.",
      });
      setErrors({});
      setAdding(false);
      router.refresh();
    });

  const remove = (video: Attachment & { version: number | null }) =>
    startTransition(async () => {
      const result = await removeAttachment(video.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Version ${video.version} removed`);
      router.refresh();
    });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  return (
    <Panel
      title="Edited video"
      description={latest ? `${videos.length} ${videos.length === 1 ? "version" : "versions"}` : undefined}
      className={cn(latest && "border-primary/30")}
      action={
        canAdd &&
        !showForm && (
          <Button size="sm" variant="secondary" className="bg-surface-strong ring-1 ring-border" onClick={() => setAdding(true)}>
            <PlusIcon /> {latest ? "New version" : "Add version"}
          </Button>
        )
      }
    >
      {latest ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-primary/8 p-3 ring-1 ring-primary/20 sm:flex-nowrap">
          <a
            href={latest.href ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
            aria-label={`Open version ${latest.version}`}
          >
            <PlayIcon className="size-5 fill-current" />
          </a>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <VersionBadge version={latest.version} strong />
              <span className="truncate">{latest.label || "Latest edit"}</span>
              {latest.inClickUp && <ClickUpMark className="size-3.5 text-muted-foreground" title="Also in ClickUp" />}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {latest.href ? hostOf(latest.href) : "Link"} · {latest.addedByName ?? "Someone"} · {timeAgo(latest.createdAt, renderedAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {latest.href && (
              <>
                <Button size="sm" asChild>
                  <a href={latest.href} target="_blank" rel="noreferrer">
                    <ExternalLinkIcon /> Open
                  </a>
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => void copy(latest.href!)} aria-label="Copy link">
                  <CopyIcon />
                </Button>
              </>
            )}
            {(canRemoveAny || latest.addedBy === currentUserId) && (
              <Button size="icon-sm" variant="ghost" className="text-muted-foreground" onClick={() => remove(latest)} disabled={pending} aria-label={`Remove version ${latest.version}`}>
                <XIcon />
              </Button>
            )}
          </div>
        </div>
      ) : (
        !showForm && <p className="text-sm text-muted-foreground">No edited video yet. It shows here once the editor sends it.</p>
      )}

      {showForm && (
        <form onSubmit={submitWith(send)} className={cn("grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end", latest && "mt-4 rounded-xl border border-dashed p-3")}>
          <FormRow label={latest ? `Version ${next} link` : "Link to the edit"} error={errors.url}>
            <Input
              name="url"
              type="url"
              placeholder="https://f.io/… or a Drive link"
              autoFocus={adding}
              required
              aria-invalid={!!errors.url}
              className="h-9"
            />
          </FormRow>
          <FormRow label="Note" error={errors.label}>
            <Input name="label" placeholder={latest ? "e.g. Fixed captions" : "Optional"} maxLength={120} className="h-9" />
          </FormRow>
          <div className="flex gap-1.5">
            {adding && (
              <Button type="button" variant="ghost" onClick={() => setAdding(false)} disabled={pending}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Send v{next}
            </Button>
          </div>
        </form>
      )}

      {earlier.length > 0 && (
        <Collapsible className="mt-3">
          <CollapsibleTrigger className="group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ChevronDownIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
            Earlier versions ({earlier.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 grid grid-cols-1 gap-1">
              {earlier.map((video) => (
                <li key={video.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/40">
                  <VersionBadge version={video.version} />
                  {video.href ? (
                    <a href={video.href} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:text-primary">
                      {video.label || hostOf(video.href)}
                    </a>
                  ) : (
                    <span className="min-w-0 truncate">{video.label || "Link"}</span>
                  )}
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {video.addedByName ?? "Someone"} · {timeAgo(video.createdAt, renderedAt)}
                  </span>
                  {(canRemoveAny || video.addedBy === currentUserId) && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground opacity-100 group-hover:opacity-100 focus-visible:opacity-100 sm:opacity-0"
                      onClick={() => remove(video)}
                      disabled={pending}
                      aria-label={`Remove version ${video.version}`}
                    >
                      <XIcon />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Panel>
  );
}

export function VersionBadge({ version, strong = false, className }: { version: number | null; strong?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-semibold tabular",
        strong ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      v{version ?? 1}
    </span>
  );
}
