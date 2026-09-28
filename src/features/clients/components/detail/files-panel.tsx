"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLinkIcon, FileTextIcon, FolderOpenIcon, Loader2Icon, PencilIcon, UploadIcon, XIcon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { setContract, updateDriveFolder } from "../../actions";

const MAX_BYTES = 25 * 1024 * 1024;

export function FilesPanel({
  clientId,
  contractPath,
  contractUrl,
  driveFolderUrl,
}: {
  clientId: string;
  contractPath: string | null;
  contractUrl: string | null;
  driveFolderUrl: string | null;
}) {
  return (
    <Panel title="Contract & files">
      <div className="grid gap-4">
        <ContractField clientId={clientId} path={contractPath} url={contractUrl} />
        <DriveField clientId={clientId} url={driveFolderUrl} />
      </div>
    </Panel>
  );
}

function ContractField({ clientId, path, url }: { clientId: string; path: string | null; url: string | null }) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  // Upload straight to private storage, then record the path.
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") return void toast.error("Contracts must be PDF files.");
    if (file.size > MAX_BYTES) return void toast.error("That PDF is over 25 MB.");

    setBusy(true);
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, "-").slice(-80);
      const objectPath = `${clientId}/${Date.now()}-${safeName}`;
      const { error } = await createClient().storage.from("contracts").upload(objectPath, file, { contentType: "application/pdf" });
      if (error) throw new Error(error.message);
      const result = await setContract(clientId, objectPath);
      if (!result.ok) throw new Error(result.error);
      toast.success("Contract uploaded");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    const result = await setContract(clientId, null);
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    toast.success("Contract removed");
    router.refresh();
  };

  const fileName = path?.split("/").pop()?.replace(/^\d+-/, "");

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Signed contract</p>
      <input ref={input} type="file" accept="application/pdf" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} aria-label="Upload contract PDF" />
      {path ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger/12 text-danger ring-1 ring-danger/20">
            <FileTextIcon className="size-5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{fileName}</span>
          {url && (
            <Button asChild variant="ghost" size="icon-sm" aria-label="Open contract">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLinkIcon />
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={() => input.current?.click()} disabled={busy} aria-label="Replace contract">
            {busy ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={remove} disabled={busy} aria-label="Remove contract">
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
            "grid w-full place-items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
            dragging && "border-primary bg-primary/5 text-foreground",
          )}
        >
          {busy ? <Loader2Icon className="size-5 animate-spin" /> : <UploadIcon className="size-5" />}
          <span>
            <span className="font-medium text-foreground">Upload the signed PDF</span> or drop it here
          </span>
          <span className="text-xs">Private. Only admins can open it. Max 25 MB.</span>
        </button>
      )}
    </div>
  );
}

function DriveField({ clientId, url }: { clientId: string; url: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(!url);
  const [value, setValue] = React.useState(url ?? "");
  const [pending, startTransition] = React.useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await updateDriveFolder(clientId, value);
      if (!result.ok) return void toast.error(result.error);
      toast.success(value ? "Drive folder saved" : "Drive folder removed");
      setEditing(!value);
      router.refresh();
    });

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Google Drive folder</p>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex gap-2"
        >
          <Input
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
            aria-label="Google Drive folder link"
          />
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Save
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-status-online/12 text-status-online ring-1 ring-status-online/20">
            <FolderOpenIcon className="size-5" />
          </span>
          <a href={url!} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary">
            Open Drive folder
          </a>
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label="Edit Drive link">
            <PencilIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
