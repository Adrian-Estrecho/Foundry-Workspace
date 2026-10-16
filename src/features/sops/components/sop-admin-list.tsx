"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpenIcon, EyeIcon, FileEditIcon, PencilIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database";
import type { SopWorkspace } from "./sop-document";
import { SopReader } from "./sop-reader";

type Row = {
  id: string;
  title: string;
  category: string;
  content: Json;
  required: boolean;
  published: boolean;
  updatedAt: string;
  /** Who can see it, in a few words ("Everyone", "Admins & managers"…). */
  audience: string;
  everyone: boolean;
  /** Editors who can see it and have read it, of all who can see it. */
  readBy: number;
  teamSize: number;
};

/** An admin's SOPs in one category: drafts included, who can see each one and who has read it. */
export function SopAdminList({
  sops,
  workspace,
  renderedAt,
}: {
  sops: Row[];
  workspace: SopWorkspace;
  renderedAt: number;
}) {
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const preview = sops.find((sop) => sop.id === previewId) ?? null;

  return (
    <>
      <ul className="grid grid-cols-1 gap-2">
        {sops.map((sop) => {
          const allRead = sop.teamSize > 0 && sop.readBy >= sop.teamSize;
          return (
            <li key={sop.id} className="flex items-center gap-3 rounded-lg bg-surface p-3 ring-1 ring-border">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
                {sop.published ? <BookOpenIcon className="size-5" /> : <FileEditIcon className="size-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/sops/${sop.id}/edit`} className="truncate text-sm font-medium hover:underline">
                    {sop.title}
                  </Link>
                  {sop.required && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">Required</span>}
                  {!sop.published && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Draft</span>}
                  {!sop.everyone && (
                    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <UsersIcon className="size-3 shrink-0" aria-hidden="true" />
                      <span className="sr-only">Only </span>
                      <span className="truncate">{sop.audience}</span>
                    </span>
                  )}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {sop.published ? (
                    <span className={cn(allRead && "text-success")}>
                      Read by {sop.readBy} of {sop.teamSize} {sop.teamSize === 1 ? "editor" : "editors"}
                      {!sop.everyone && " who can see it"}
                    </span>
                  ) : (
                    "Only people who write SOPs can see drafts"
                  )}{" "}
                  · updated {timeAgo(sop.updatedAt, renderedAt)}
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setPreviewId(sop.id)} aria-label={`Preview ${sop.title}`}>
                <EyeIcon /> <span className="hidden sm:inline">Preview</span>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/sops/${sop.id}/edit`} aria-label={`Edit ${sop.title}`}>
                  <PencilIcon /> <span className="hidden sm:inline">Edit</span>
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>

      <SopReader
        sop={preview && { ...preview, draft: !preview.published }}
        workspace={workspace}
        onClose={() => setPreviewId(null)}
        status={preview && (preview.published ? `This is how it reads. Who can see it: ${preview.audience}.` : "A draft: only people who write SOPs can see it.")}
        actions={
          <>
            <Button variant="ghost" onClick={() => setPreviewId(null)}>
              Close
            </Button>
            {preview && (
              <Button asChild>
                <Link href={`/sops/${preview.id}/edit`}>
                  <PencilIcon /> Edit
                </Link>
              </Button>
            )}
          </>
        }
      />
    </>
  );
}
