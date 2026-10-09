"use client";

import * as React from "react";
import { BookOpenIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Enums, Json } from "@/types/database";
import { SOP_CATEGORY_LABEL } from "../constants";
import { SopDocument, type SopWorkspace } from "./sop-document";

export type ReaderSop = {
  id: string;
  title: string;
  category: Enums<"sop_category">;
  content: Json;
  required?: boolean;
  draft?: boolean;
  updatedAt?: string | null;
};

/** Opens an SOP as its page, nearly full screen, with `actions` along the bottom. */
export function SopReader({
  sop,
  workspace,
  onClose,
  status,
  actions,
}: {
  sop: ReaderSop | null;
  workspace: SopWorkspace;
  onClose: () => void;
  /** A line about it on the left of the bottom bar, e.g. when it was read. */
  status?: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <Dialog open={!!sop} onOpenChange={(open) => !open && onClose()}>
      {sop && (
        <DialogContent
          showCloseButton={false}
          className="flex h-dvh max-h-dvh w-full max-w-full flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-3rem)] sm:max-w-5xl sm:rounded-2xl"
        >
          <header className="flex items-center gap-3 border-b px-4 py-2.5">
            <BookOpenIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-sm font-medium">{sop.title}</DialogTitle>
              <DialogDescription className="truncate text-xs">{SOP_CATEGORY_LABEL[sop.category]}</DialogDescription>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <XIcon />
              </Button>
            </DialogClose>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-surface-strong px-3 py-6 sm:px-8 sm:py-10 dark:bg-background">
            <SopDocument
              title={sop.title}
              category={sop.category}
              content={sop.content}
              required={sop.required}
              draft={sop.draft}
              updatedAt={sop.updatedAt}
              workspace={workspace}
            />
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t px-4 py-3">
            {status && <div className="mr-auto text-xs text-muted-foreground">{status}</div>}
            <div className="flex gap-2">{actions}</div>
          </footer>
        </DialogContent>
      )}
    </Dialog>
  );
}
