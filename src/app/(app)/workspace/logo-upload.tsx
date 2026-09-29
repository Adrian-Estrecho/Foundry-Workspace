"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageUpIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOGO_BUCKET, LOGO_MAX_BYTES, LOGO_TYPES, workspaceLogoUrl } from "@/features/workspaces/constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { setWorkspaceLogo } from "./actions";

const HANDLES = ["-top-1 -left-1", "-top-1 -right-1", "-bottom-1 -left-1", "-bottom-1 -right-1"];

/**
 * The workspace logo, framed like a selected element in an editor. Uploads
 * straight to storage and saves at once, apart from the rest of the form.
 */
export function LogoUpload({
  workspaceId,
  logoUrl,
  onChange,
}: {
  workspaceId: string;
  logoUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const extension = LOGO_TYPES[file.type];
    if (!extension) return void toast.error("Use a PNG, JPG or WebP image.");
    if (file.size > LOGO_MAX_BYTES) return void toast.error("That image is over 2 MB.");

    setBusy(true);
    const storage = createClient().storage.from(LOGO_BUCKET);
    const path = `${workspaceId}/logo-${Date.now()}.${extension}`;
    try {
      const { error } = await storage.upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (error) throw new Error("Couldn't upload the logo. Try again.");
      const result = await setWorkspaceLogo(path);
      if (!result.ok) {
        await storage.remove([path]);
        throw new Error(result.error);
      }
      onChange(workspaceLogoUrl(path));
      toast.success("Logo updated");
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
    const result = await setWorkspaceLogo(null);
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    onChange(null);
    toast.success("Logo removed");
    router.refresh();
  };

  const selected = Boolean(logoUrl) || dragging;

  return (
    <div className="flex items-center gap-5">
      <input
        ref={input}
        type="file"
        accept={Object.keys(LOGO_TYPES).join(",")}
        className="sr-only"
        onChange={(event) => upload(event.target.files?.[0])}
        aria-label="Upload logo"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files[0]);
        }}
        disabled={busy}
        aria-label={logoUrl ? "Replace logo" : "Upload logo"}
        className={cn(
          "group relative grid size-24 shrink-0 place-items-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          selected
            ? "bg-primary/8 outline-[1.5px] outline-offset-0 outline-primary"
            : "border border-dashed border-border bg-surface hover:border-primary/60",
        )}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage URL, already small
          <img src={logoUrl} alt="" className="size-full rounded-xl object-cover" />
        ) : (
          <span className="grid justify-items-center gap-1 text-muted-foreground transition-colors group-hover:text-foreground">
            <ImageUpIcon className="size-6" />
            <span className="text-[11px] font-medium">Add logo</span>
          </span>
        )}
        {selected &&
          HANDLES.map((position) => (
            <span
              key={position}
              aria-hidden="true"
              className={cn("absolute size-2.5 rounded-[3px] border-[1.5px] border-primary bg-card", position)}
            />
          ))}
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-xl bg-card/80">
            <Loader2Icon className="size-5 animate-spin text-primary" />
          </span>
        )}
      </button>

      <div className="grid min-w-0 gap-2">
        <div>
          <p className="text-sm font-medium">Logo</p>
          <p className="text-xs text-muted-foreground">Square PNG, JPG or WebP, at least 256 px. Up to 2 MB.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={busy}>
            <UploadIcon /> {logoUrl ? "Replace" : "Upload"}
          </Button>
          {logoUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={busy} className="text-muted-foreground">
              <Trash2Icon /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
