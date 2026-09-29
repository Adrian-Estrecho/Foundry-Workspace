"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, Loader2Icon, SaveIcon, Trash2Icon } from "lucide-react";
import { FormRow, NativeSelect, submitWith } from "@/components/shared/form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Constants, type Enums, type Json } from "@/types/database";
import { createSop, deleteSop, updateSop } from "../actions";
import { SOP_CATEGORY_LABEL } from "../constants";
import { RichTextEditor } from "./rich-text-editor";

type Sop = {
  id: string;
  title: string;
  category: Enums<"sop_category">;
  content: Json;
  is_required: boolean;
  is_published: boolean;
};

/**
 * Write or edit an SOP. Required ones are part of every editor's
 * onboarding; drafts stay hidden from editors until published.
 */
export function SopForm({ sop }: { sop?: Sop }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = sop ? await updateSop(sop.id, formData) : await createSop(formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success(sop ? "SOP saved" : "SOP created");
      router.push("/sops");
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      if (!sop) return;
      const result = await deleteSop(sop.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("SOP deleted");
      router.push("/sops");
    });

  return (
    <form onSubmit={submitWith(submit)} className="mx-auto grid max-w-4xl gap-5">
      <div>
        <Link href="/sops" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> SOPs
        </Link>
        <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight">{sop ? "Edit SOP" : "New SOP"}</h1>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-[1fr_16rem]">
        <FormRow label="Title" required error={errors.title}>
          <Input name="title" required maxLength={160} defaultValue={sop?.title} autoFocus={!sop} aria-invalid={!!errors.title} />
        </FormRow>
        <FormRow label="Category" required error={errors.category}>
          <NativeSelect name="category" defaultValue={sop?.category ?? "editing_workflow"}>
            {Constants.public.Enums.sop_category.map((category) => (
              <option key={category} value={category}>
                {SOP_CATEGORY_LABEL[category]}
              </option>
            ))}
          </NativeSelect>
        </FormRow>
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-lg bg-surface p-3 text-sm ring-1 ring-border">
            <Checkbox name="is_published" defaultChecked={sop?.is_published ?? true} className="mt-0.5" />
            <span>
              <span className="font-medium">Published</span>
              <span className="block text-muted-foreground">Editors can read it. Untick to keep it as a draft.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg bg-surface p-3 text-sm ring-1 ring-border">
            <Checkbox name="is_required" defaultChecked={sop?.is_required ?? false} className="mt-0.5" />
            <span>
              <span className="font-medium">Required reading</span>
              <span className="block text-muted-foreground">New editors must read it during onboarding.</span>
            </span>
          </label>
        </div>
      </div>

      {/* Not a <label>: a click inside one would also press the first toolbar button. */}
      <div className="grid gap-2">
        <p className="text-sm font-medium">Content</p>
        <RichTextEditor name="content" initial={sop?.content ?? null} label="SOP content" />
        {errors.content && (
          <span className="text-xs text-danger" role="alert">
            {errors.content}
          </span>
        )}
      </div>

      {sop && (
        <label className="flex items-start gap-3 text-sm">
          <Checkbox name="reset_reads" className="mt-0.5" />
          <span>
            <span className="font-medium">Ask everyone to read it again</span>
            <span className="block text-muted-foreground">For big changes: clears who has read it, so it shows as unread for editors.</span>
          </span>
        </label>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {sop ? (
          <Button type="button" variant="ghost" className="text-danger" onClick={() => setDeleteOpen(true)} disabled={pending}>
            <Trash2Icon /> Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href="/sops">Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            {sop ? "Save SOP" : "Create SOP"}
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this SOP?</AlertDialogTitle>
            <AlertDialogDescription>It disappears for everyone, along with who has read it. It can&apos;t be undone.</AlertDialogDescription>
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
              Delete SOP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
