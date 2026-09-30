"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLinkIcon, FileIcon, LinkIcon, Loader2Icon, PaperclipIcon, PlusIcon, UploadIcon, XIcon } from "lucide-react";
import { FormRow, submitWith } from "@/components/shared/form";
import { EmptyState, Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { timeAgo } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { addTaskLink, recordTaskFile, removeAttachment } from "../../actions";
import { MAX_TASK_FILE_BYTES } from "../../constants";

export type Attachment = {
  id: string;
  kind: "link" | "file";
  href: string | null;
  label: string | null;
  addedBy: string | null;
  addedByName: string | null;
  createdAt: string;
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * Review links (Frame.io, Drive) and files. Files go straight from the
 * browser to private storage and open through short-lived links.
 */
export function AttachmentsPanel({
  taskId,
  attachments,
  canAdd,
  currentUserId,
  canRemoveAny,
  renderedAt,
}: {
  taskId: string;
  attachments: Attachment[];
  canAdd: boolean;
  currentUserId: string;
  /** Remove anyone's files, not just their own. */
  canRemoveAny: boolean;
  renderedAt: number;
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const fileInput = React.useRef<HTMLInputElement>(null);

  const saveLink = (formData: FormData) =>
    startTransition(async () => {
      const result = await addTaskLink(taskId, formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success("Link added");
      setErrors({});
      setAdding(false);
      router.refresh();
    });

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_TASK_FILE_BYTES) return void toast.error("That file is over 100 MB. Share a Drive or Frame.io link instead.");
    setBusy(true);
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, "-").slice(-80);
      const path = `${taskId}/${Date.now()}-${safeName}`;
      const { error } = await createClient()
        .storage.from("task-files")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (error) throw new Error(error.message);
      const result = await recordTaskFile(taskId, path, file.name);
      if (!result.ok) throw new Error(result.error);
      toast.success("File uploaded", { description: file.name });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const remove = (attachment: Attachment) =>
    startTransition(async () => {
      const result = await removeAttachment(attachment.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(attachment.kind === "file" ? "File removed" : "Link removed");
      router.refresh();
    });

  return (
    <Panel
      title="Links & files"
      action={
        canAdd && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" className="bg-surface-strong ring-1 ring-border" onClick={() => setAdding((v) => !v)}>
              <LinkIcon /> Add link
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-surface-strong ring-1 ring-border"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
              {busy ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} Upload
            </Button>
            <input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-label="Upload a file" onChange={(e) => void upload(e.target.files?.[0])} />
          </div>
        )
      }
    >
      {adding && (
        <form onSubmit={submitWith(saveLink)} className="mb-4 grid gap-3 rounded-xl border border-dashed p-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <FormRow label="Link" error={errors.url}>
            <Input name="url" type="url" placeholder="https://app.frame.io/…" autoFocus required aria-invalid={!!errors.url} className="h-9" />
          </FormRow>
          <FormRow label="Label" error={errors.label}>
            <Input name="label" placeholder="e.g. Review v2" maxLength={120} className="h-9" />
          </FormRow>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} Add
          </Button>
        </form>
      )}

      {attachments.length === 0 ? (
        <EmptyState
          icon={PaperclipIcon}
          title="Nothing attached yet"
          description={canAdd ? "Add the Frame.io review link or upload a file." : undefined}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {attachments.map((attachment) => {
            const Icon = attachment.kind === "file" ? FileIcon : LinkIcon;
            const title = attachment.label || (attachment.href ? hostOf(attachment.href) : "File");
            const canRemove = canRemoveAny || attachment.addedBy === currentUserId;
            return (
              <li key={attachment.id} className="flex items-center gap-3 rounded-lg bg-surface p-2.5 ring-1 ring-border">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/12 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  {attachment.href ? (
                    <a href={attachment.href} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:text-primary">
                      {title}
                    </a>
                  ) : (
                    <span className="block truncate text-sm font-medium">{title}</span>
                  )}
                  <span className="block truncate text-xs text-muted-foreground">
                    {attachment.kind === "link" && attachment.href ? `${hostOf(attachment.href)} · ` : ""}
                    {attachment.addedByName ?? "Someone"} · {timeAgo(attachment.createdAt, renderedAt)}
                  </span>
                </span>
                {attachment.href && (
                  <a
                    href={attachment.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${title}`}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <ExternalLinkIcon className="size-4" />
                  </a>
                )}
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    onClick={() => remove(attachment)}
                    disabled={pending}
                    aria-label={`Remove ${title}`}
                  >
                    <XIcon />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
