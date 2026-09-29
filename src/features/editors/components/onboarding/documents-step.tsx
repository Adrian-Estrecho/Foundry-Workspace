"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DownloadIcon, ExternalLinkIcon, FileTextIcon, Loader2Icon, UploadIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { DOC_TYPES, type DocType } from "../../constants";
import { recordDocument, removeDocument } from "../../onboarding-actions";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = ["application/pdf", "image/png", "image/jpeg"];

type Doc = { id: string; doc_type: string; file_name: string; url: string | null };

export function DocumentsStep({
  workspaceId,
  editorId,
  documents,
  templatesUrl,
}: {
  /** Uploads are stored under editor-docs/<workspace id>/<editor id>/. */
  workspaceId: string;
  editorId: string;
  documents: Doc[];
  templatesUrl: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {templatesUrl && (
        <Button asChild variant="outline" className="justify-self-start">
          <a href={templatesUrl} target="_blank" rel="noreferrer">
            <DownloadIcon /> Download the contract and NDA
          </a>
        </Button>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {DOC_TYPES.map((type) => (
          <DocumentSlot
            key={type.value}
            workspaceId={workspaceId}
            editorId={editorId}
            docType={type.value}
            label={type.label}
            doc={documents.find((d) => d.doc_type === type.value) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function DocumentSlot({
  workspaceId,
  editorId,
  docType,
  label,
  doc,
}: {
  workspaceId: string;
  editorId: string;
  docType: DocType;
  label: string;
  doc: Doc | null;
}) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  // Upload straight to private storage, then record it.
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) return void toast.error("Upload a PDF, PNG or JPG.");
    if (file.size > MAX_BYTES) return void toast.error("That file is over 25 MB.");

    setBusy(true);
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, "-").slice(-80);
      const path = `${workspaceId}/${editorId}/${docType}-${Date.now()}-${safeName}`;
      const { error } = await createClient().storage.from("editor-docs").upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      const result = await recordDocument(docType, path, file.name);
      if (!result.ok) throw new Error(result.error);
      toast.success(`${label} uploaded`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    if (!doc) return;
    setBusy(true);
    const result = await removeDocument(doc.id);
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    toast.success(`${label} removed`);
    router.refresh();
  };

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT.join(",")}
        className="sr-only"
        onChange={(e) => upload(e.target.files?.[0])}
        aria-label={`Upload ${label.toLowerCase()}`}
      />
      {doc ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success ring-1 ring-success/25">
            <FileTextIcon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">{label}</span>
            <span className="block truncate text-sm font-medium">{doc.file_name}</span>
          </span>
          {doc.url && (
            <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${label.toLowerCase()}`}>
              <a href={doc.url} target="_blank" rel="noreferrer">
                <ExternalLinkIcon />
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={() => input.current?.click()} disabled={busy} aria-label={`Replace ${label.toLowerCase()}`}>
            {busy ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={remove} disabled={busy} aria-label={`Remove ${label.toLowerCase()}`}>
            <XIcon />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files[0]);
          }}
          disabled={busy}
          className={cn(
            "grid w-full place-items-center gap-1.5 rounded-2xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
            dragging && "border-primary bg-primary/5 text-foreground",
          )}
        >
          {busy ? <Loader2Icon className="size-5 animate-spin" /> : <UploadIcon className="size-5" />}
          <span>
            <span className="font-medium text-foreground">Upload {label.toLowerCase()}</span> or drop it here
          </span>
          <span className="text-xs">PDF, PNG or JPG · up to 25 MB · only you and admins can see it</span>
        </button>
      )}
    </div>
  );
}
