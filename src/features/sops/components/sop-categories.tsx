"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownIcon, ArrowUpIcon, FolderCogIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { NativeSelect } from "@/components/shared/form";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { addSopCategory, loadSopCategories, removeSopCategory, renameSopCategory, reorderSopCategories, type SopCategoryInUse } from "../category-actions";

const sopCount = (n: number) => `${n} ${n === 1 ? "SOP" : "SOPs"}`;

/** Icon button next to "New SOP" that opens the category editor. */
export function SopCategoriesButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)} aria-label="Edit categories">
            <FolderCogIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit categories</TooltipContent>
      </Tooltip>
      <SopCategoriesDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * The workspace's SOP categories in their order, which is the order of the
 * SOPs page. Add, rename (type over a name), reorder with the arrows, or
 * remove one, moving its SOPs elsewhere. Changes save straight away.
 */
export function SopCategoriesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [categories, setCategories] = React.useState<SopCategoryInUse[] | null>(null);
  const [removing, setRemoving] = React.useState<SopCategoryInUse | null>(null);
  // Bumped after each change to load the list again.
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    loadSopCategories().then((result) => {
      if (!live) return;
      if (result.ok) setCategories(result.data);
      else toast.error(result.error);
    });
    return () => {
      live = false;
    };
  }, [open, version]);

  const changed = () => {
    setVersion((v) => v + 1);
    router.refresh();
  };

  const move = async (index: number, by: -1 | 1) => {
    if (!categories) return;
    const next = [...categories];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setCategories(next);
    const result = await reorderSopCategories(next.map((c) => c.id));
    if (!result.ok) toast.error(result.error);
    changed();
  };

  const rename = async (category: SopCategoryInUse, value: string) => {
    const name = value.trim();
    if (name === category.name) return true;
    const result = await renameSopCategory(category.id, name);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(`Renamed to ${name}`);
    changed();
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">SOP categories</DialogTitle>
          <DialogDescription>
            How the SOPs page is grouped, in this order. Type over a name to rename it. Changes save straight away.
          </DialogDescription>
        </DialogHeader>
        {categories ? (
          <div className="grid gap-4">
            <ul className="grid grid-cols-1 gap-2">
              {categories.map((category, index) => (
                <li key={category.id} className="flex items-center gap-2 rounded-lg bg-surface p-2 ring-1 ring-border">
                  <span className="flex shrink-0 flex-col">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={`Move ${category.name} up`}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={index === categories.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={`Move ${category.name} down`}
                    >
                      <ArrowDownIcon />
                    </Button>
                  </span>
                  <NameInput category={category} onRename={rename} />
                  <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular">{sopCount(category.sops)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={categories.length === 1}
                    onClick={() => setRemoving(category)}
                    aria-label={`Remove ${category.name}`}
                    title={categories.length === 1 ? "Keep at least one category" : undefined}
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
            <AddCategory onAdded={changed} />
          </div>
        ) : (
          <div className="grid h-48 place-items-center" aria-busy="true">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            <span className="sr-only">Loading categories</span>
          </div>
        )}
        <RemoveCategory
          category={removing}
          others={(categories ?? []).filter((c) => c.id !== removing?.id)}
          onClose={() => setRemoving(null)}
          onRemoved={changed}
        />
      </DialogContent>
    </Dialog>
  );
}

/** A category's name, saved when you leave the field or press Enter (Escape puts it back). */
function NameInput({ category, onRename }: { category: SopCategoryInUse; onRename: (category: SopCategoryInUse, value: string) => Promise<boolean> }) {
  const [value, setValue] = React.useState(category.name);
  const save = async () => {
    if (!(await onRename(category, value))) setValue(category.name);
  };
  return (
    <Input
      value={value}
      maxLength={60}
      onChange={(event) => setValue(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape" && value !== category.name) {
          // Keep the dialog open: this only undoes the typing.
          event.stopPropagation();
          setValue(category.name);
        }
      }}
      aria-label={`Name of ${category.name}`}
      className="h-9 min-w-0 flex-1"
    />
  );
}

function AddCategory({ onAdded }: { onAdded: (category: { id: string; name: string }) => void }) {
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const add = (event: React.FormEvent) => {
    event.preventDefault();
    // React bubbles the submit through the dialog's portal to any form around it (the SOP form).
    event.stopPropagation();
    startTransition(async () => {
      const result = await addSopCategory(name);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Added ${result.data.name}`);
      setName("");
      onAdded(result.data);
    });
  };
  return (
    <form onSubmit={add} className="flex items-center gap-2">
      <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="New category" aria-label="New category" className="h-9" />
      <Button type="submit" variant="secondary" disabled={pending || !name.trim()}>
        {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} Add
      </Button>
    </form>
  );
}

function RemoveCategory({
  category,
  others,
  onClose,
  onRemoved,
}: {
  category: SopCategoryInUse | null;
  others: SopCategoryInUse[];
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [moveTo, setMoveTo] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const hasSops = !!category && category.sops > 0;
  const target = moveTo || others[0]?.id || "";

  const remove = () =>
    startTransition(async () => {
      if (!category) return;
      const result = await removeSopCategory(category.id, hasSops ? target : null);
      if (!result.ok) return void toast.error(result.error);
      toast.success(hasSops ? `Removed ${category.name}; its SOPs moved to ${others.find((c) => c.id === target)?.name}` : `Removed ${category.name}`);
      setMoveTo("");
      onClose();
      onRemoved();
    });

  return (
    <AlertDialog open={!!category} onOpenChange={(value) => !value && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {category?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasSops ? `Its ${sopCount(category.sops)} move to the category you choose. Nothing else changes.` : "It has no SOPs in it."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {hasSops && (
          <NativeSelect aria-label="Move its SOPs to" value={target} onChange={(event) => setMoveTo(event.target.value)}>
            {others.map((other) => (
              <option key={other.id} value={other.id}>
                Move to {other.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending || (hasSops && !target)}
            onClick={(event) => {
              event.preventDefault();
              remove();
            }}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Remove category
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A quick "New category" from the SOP form's category menu. */
export function NewSopCategoryDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (category: { id: string; name: string }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>It goes at the end of the list. Reorder categories from the SOPs page.</DialogDescription>
        </DialogHeader>
        <AddCategory
          onAdded={(category) => {
            onAdded(category);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
