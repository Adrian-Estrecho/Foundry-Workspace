"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, EyeIcon, Loader2Icon, MonitorIcon, PencilIcon, SaveIcon, SmartphoneIcon, Trash2Icon } from "lucide-react";
import { FormRow, NativeSelect, submitWith } from "@/components/shared/form";
import { Segmented } from "@/components/shared/segmented";
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
import { cn } from "@/lib/utils";
import { Constants, type Enums, type Json } from "@/types/database";
import { createSop, deleteSop, updateSop } from "../actions";
import { SOP_CATEGORY_LABEL } from "../constants";
import { SopDocument, type SopWorkspace } from "./sop-document";
import { ElementPalette } from "./sop-elements";
import { SopEditor, useSopEditor } from "./rich-text-editor";

type Sop = {
  id: string;
  title: string;
  category: Enums<"sop_category">;
  content: Json;
  is_required: boolean;
  is_published: boolean;
};

type Preview = { title: string; category: Enums<"sop_category">; content: Json; required: boolean; draft: boolean };

const EMPTY_DOC = { type: "doc", content: [] };

/**
 * Write or edit an SOP, full screen: elements to add on the left (steps,
 * checklists, notes, do's and don'ts), the page in the middle. Preview shows
 * it as editors read it, as a page, on a desktop or a phone. Required SOPs
 * are part of every editor's onboarding; drafts stay hidden from editors.
 */
export function SopForm({ sop, workspace }: { sop?: Sop; workspace: SopWorkspace }) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const editScroll = React.useRef({ page: 0, column: 0 });
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"edit" | "preview">("edit");
  const [device, setDevice] = React.useState<"desktop" | "phone">("desktop");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const editor = useSopEditor({ initial: sop?.content ?? null, label: "SOP content" });

  const currentContent = () => (editor?.getJSON() ?? sop?.content ?? EMPTY_DOC) as Json;

  const changeMode = (next: "edit" | "preview") => {
    if (next === mode || !formRef.current) return;
    if (next === "preview") {
      const data = new FormData(formRef.current);
      setPreview({
        title: String(data.get("title") ?? ""),
        category: data.get("category") as Enums<"sop_category">,
        content: currentContent(),
        required: data.get("is_required") === "on",
        draft: data.get("is_published") !== "on",
      });
      editScroll.current = { page: window.scrollY, column: scrollRef.current?.scrollTop ?? 0 };
    }
    setMode(next);
  };

  // The preview starts at the top; going back to editing returns to where you were.
  React.useLayoutEffect(() => {
    const { page, column } = mode === "preview" ? { page: 0, column: 0 } : editScroll.current;
    window.scrollTo({ top: page });
    scrollRef.current?.scrollTo({ top: column });
  }, [mode]);

  const submit = (formData: FormData) =>
    startTransition(async () => {
      formData.set("content", JSON.stringify(currentContent()));
      const result = sop ? await updateSop(sop.id, formData) : await createSop(formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (result.fieldErrors) setMode("edit");
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
    <form
      ref={formRef}
      onSubmit={submitWith(submit)}
      // The server checks the fields: the browser can't point at one hidden by the preview.
      noValidate
      className="-mx-4 -mt-6 -mb-12 flex flex-col sm:-mx-6 lg:-mx-8 lg:h-[calc(100dvh-3.5rem)]"
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b bg-background px-4 py-3 sm:px-6">
        <Button asChild variant="ghost" size="icon" aria-label="Back to SOPs">
          <Link href="/sops">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">SOPs · {workspace.name}</p>
          <h1 className="font-heading text-lg leading-tight font-semibold tracking-tight">{sop ? "Edit SOP" : "New SOP"}</h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented
            label="Mode"
            value={mode}
            onChange={changeMode}
            options={[
              { value: "edit", label: "Edit", icon: PencilIcon },
              { value: "preview", label: "Preview", icon: EyeIcon },
            ]}
          />
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            {sop ? "Save SOP" : "Create SOP"}
          </Button>
        </div>
      </header>

      <div className={cn("grid min-h-0 flex-1 grid-cols-1", mode === "edit" && "lg:grid-cols-[15rem_minmax(0,1fr)]")}>
        {mode === "edit" && (
          <aside aria-label="Add to the SOP" className="hidden overflow-y-auto border-r p-3 lg:block">
            <ElementPalette editor={editor} />
          </aside>
        )}

        <div ref={scrollRef} className="min-w-0 lg:overflow-y-auto">
          {/* Hidden, not removed, while previewing: it keeps the fields and the editor. */}
          <div className={cn("mx-auto grid max-w-4xl gap-5 px-4 py-6 sm:px-6 lg:py-8", mode === "preview" && "hidden")}>
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
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-medium">Content</p>
                <p className="text-xs text-muted-foreground">
                  <span className="hidden lg:inline">Add steps, checklists and notes from the left. </span>
                  Preview shows it as editors read it.
                </p>
              </div>
              <SopEditor editor={editor} />
              {errors.content && (
                <span className="text-xs text-danger" role="alert">
                  {errors.content}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-start justify-between gap-4">
              {sop ? (
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox name="reset_reads" className="mt-0.5" />
                  <span>
                    <span className="font-medium">Ask everyone to read it again</span>
                    <span className="block text-muted-foreground">For big changes: clears who has read it, so it shows as unread for editors.</span>
                  </span>
                </label>
              ) : (
                <span />
              )}
              {sop && (
                <Button type="button" variant="ghost" className="text-danger" onClick={() => setDeleteOpen(true)} disabled={pending}>
                  <Trash2Icon /> Delete SOP
                </Button>
              )}
            </div>
          </div>

          {mode === "preview" && preview && (
            <div className="min-h-full bg-surface-strong px-3 py-6 sm:px-8 sm:py-10 dark:bg-background">
              <div className="mx-auto mb-5 flex max-w-[52rem] flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {preview.draft ? "How editors will see it once it's published." : "How editors see it."}
                </p>
                <Segmented
                  label="Preview size"
                  value={device}
                  onChange={setDevice}
                  options={[
                    { value: "desktop", label: "Desktop", icon: MonitorIcon },
                    { value: "phone", label: "Phone", icon: SmartphoneIcon },
                  ]}
                />
              </div>
              <div className={cn("mx-auto transition-[max-width] duration-300", device === "phone" ? "max-w-[390px]" : "max-w-[52rem]")}>
                <SopDocument {...preview} workspace={workspace} />
              </div>
            </div>
          )}
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
