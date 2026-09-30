"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { removeEditor } from "../actions";

/** Confirms taking an inactive editor off the team. */
export function RemoveEditorDialog({
  editor,
  onOpenChange,
  onRemoved,
}: {
  /** Who to remove; null keeps the dialog closed. */
  editor: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onRemoved?: () => void;
}) {
  const [pending, startTransition] = React.useTransition();

  const remove = () =>
    startTransition(async () => {
      if (!editor) return;
      const result = await removeEditor(editor.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${editor.name} deleted`, { description: "Their hours and past work are kept." });
      onOpenChange(false);
      onRemoved?.();
    });

  return (
    <AlertDialog open={Boolean(editor)} onOpenChange={(open) => !pending && onOpenChange(open)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {editor?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They leave the team and lose access to this workspace. Their hours, shifts and finished tasks stay in your
            records, and you can invite them again later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              remove();
            }}
          >
            Delete editor
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
