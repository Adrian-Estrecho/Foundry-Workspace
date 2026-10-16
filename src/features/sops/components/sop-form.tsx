"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  FileUpIcon,
  Loader2Icon,
  MonitorIcon,
  PencilIcon,
  SaveIcon,
  SmartphoneIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
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
import type { Json } from "@/types/database";
import { createSop, deleteSop, updateSop } from "../actions";
import { EVERYONE, audienceOf, audienceSummary, type Audience, type Reader } from "../audience";
import { describeImport, readDocx, tidySop, type ImportResult } from "../import";
import type { SopCategory } from "../queries";
import { AudienceDialog } from "./sop-audience";
import { NewSopCategoryDialog } from "./sop-categories";
import { SopDocument, type SopWorkspace } from "./sop-document";
import { ElementPalette } from "./sop-elements";
import { SopEditor, useSopEditor } from "./rich-text-editor";

type Sop = {
  id: string;
  title: string;
  category_id: string | null;
  content: Json;
  is_required: boolean;
  is_published: boolean;
  visible_to_admins: boolean;
  visible_to_editors: boolean;
  shared_with: string[];
};

type Preview = { title: string; category: string; content: Json; required: boolean; draft: boolean };
type Imported = ImportResult & { name: string };

const EMPTY_DOC = { type: "doc", content: [] };
/** The category menu's last choice, which adds one. */
const NEW_CATEGORY = "new";

/**
 * Write or edit an SOP, full screen: elements to add on the left (steps,
 * checklists, notes, do's and don'ts, tables), the page in the middle.
 * A Word file or Google Doc can be imported (or dropped on the page) and is
 * laid out as an SOP. Preview shows it as editors read it, as a page, on a
 * desktop or a phone. Each SOP can be for everyone, admins and managers,
 * editors, or people picked by name. Required SOPs are part of onboarding
 * for the editors who can see them; drafts stay hidden from readers.
 */
export function SopForm({
  sop,
  workspace,
  readers,
  categories: initialCategories,
}: {
  sop?: Sop;
  workspace: SopWorkspace;
  readers: Reader[];
  categories: SopCategory[];
}) {
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
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  const [imported, setImported] = React.useState<Imported | null>(null);
  const [audience, setAudience] = React.useState<Audience>(sop ? audienceOf(sop) : EVERYONE);
  const [audienceOpen, setAudienceOpen] = React.useState(false);
  const [required, setRequired] = React.useState(sop?.is_required ?? false);
  const [categories, setCategories] = React.useState(initialCategories);
  const [categoryId, setCategoryId] = React.useState(sop?.category_id ?? initialCategories[0]?.id ?? "");
  const [newCategoryOpen, setNewCategoryOpen] = React.useState(false);
  const editor = useSopEditor({ initial: sop?.content ?? null, label: "SOP content", onFile: (file) => void importFile(file) });

  const currentContent = () => (editor?.getJSON() ?? sop?.content ?? EMPTY_DOC) as Json;

  /** Reads a Word file (Google Docs: File → Download → .docx) and lays it out as an SOP. */
  const importFile = async (file: File) => {
    if (!editor || importing) return;
    if (!/\.docx$/i.test(file.name)) {
      return void toast.error("Import a Word file (.docx)", { description: "From Google Docs: File → Download → Microsoft Word (.docx)." });
    }
    setImporting(true);
    try {
      const found = { ...tidySop(await readDocx(file), { findTitle: true }), name: file.name };
      // With something written already, ask whether to replace it.
      if (editor.isEmpty) applyImport(found, "replace");
      else setImported(found);
    } catch {
      toast.error("Couldn't read that file", { description: "Check it's a Word document (.docx), not an older .doc, and try again." });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const applyImport = (found: Imported, how: "replace" | "append") => {
    if (!editor) return;
    if (how === "replace") editor.chain().setContent(found.html).focus("start").scrollIntoView().run();
    else editor.chain().focus().insertContentAt(editor.state.doc.content.size, found.html).scrollIntoView().run();
    // The document's title, or its file name, when the SOP has none yet.
    const title = formRef.current?.elements.namedItem("title");
    if (title instanceof HTMLInputElement && !title.value.trim()) {
      title.value = (found.title ?? found.name.replace(/\.docx$/i, "").replace(/_+/g, " ")).slice(0, 160);
    }
    setImported(null);
    const pictures = found.counts.images
      ? ` ${found.counts.images === 1 ? "A picture was" : `${found.counts.images} pictures were`} left out: SOPs don't hold pictures yet.`
      : "";
    toast.success(`Imported ${found.name}`, { description: `${describeImport(found.counts)}${pictures} Check it, then save.` });
  };

  const changeMode = (next: "edit" | "preview") => {
    if (next === mode || !formRef.current) return;
    if (next === "preview") {
      const data = new FormData(formRef.current);
      setPreview({
        title: String(data.get("title") ?? ""),
        category: categories.find((category) => category.id === data.get("category_id"))?.name ?? "",
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
          {mode === "edit" && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!editor || importing}
                onClick={() => fileRef.current?.click()}
                title="A Word file, or a Google Doc downloaded as .docx. It's laid out as an SOP."
              >
                {importing ? <Loader2Icon className="animate-spin" /> : <FileUpIcon />}
                Import .docx
              </Button>
            </>
          )}
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
              <FormRow label="Category" required error={errors.category_id}>
                <NativeSelect
                  name="category_id"
                  value={categoryId}
                  onChange={(event) => (event.target.value === NEW_CATEGORY ? setNewCategoryOpen(true) : setCategoryId(event.target.value))}
                  aria-invalid={!!errors.category_id}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                  <option value={NEW_CATEGORY}>+ New category…</option>
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
                  <Checkbox name="is_required" checked={required} onCheckedChange={(checked) => setRequired(checked === true)} className="mt-0.5" />
                  <span>
                    <span className="font-medium">Required reading</span>
                    <span className="block text-muted-foreground">
                      {audience.editors ? "New editors must read it during onboarding." : "Everyone who can see it is asked to read it."}
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setAudienceOpen(true)}
                  className="flex items-center gap-3 rounded-lg bg-surface p-3 text-left text-sm ring-1 ring-border transition-colors outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                    <UsersIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">Who can see it</span>
                    <span className="block truncate text-muted-foreground">{audienceSummary(audience, readers)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                    Change <ChevronRightIcon className="size-4" />
                  </span>
                </button>
                <input type="hidden" name="visible_to_admins" value={String(audience.admins)} />
                <input type="hidden" name="visible_to_editors" value={String(audience.editors)} />
                <input type="hidden" name="shared_with" value={JSON.stringify(audience.people)} />
                {errors.shared_with && (
                  <span className="text-xs text-danger sm:col-span-2" role="alert">
                    {errors.shared_with}
                  </span>
                )}
              </div>
            </div>

            {/* Not a <label>: a click inside one would also press the first toolbar button. */}
            <div className="grid gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-medium">Content</p>
                <p className="text-xs text-muted-foreground">
                  <span className="hidden lg:inline">Add steps, checklists and notes from the left. </span>
                  Paste or import a Google Doc or Word file and it&apos;s laid out as an SOP.
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

      <NewSopCategoryDialog
        open={newCategoryOpen}
        onOpenChange={setNewCategoryOpen}
        onAdded={(category) => {
          setCategories((current) => [...current, category]);
          setCategoryId(category.id);
        }}
      />

      <AudienceDialog open={audienceOpen} onOpenChange={setAudienceOpen} audience={audience} readers={readers} onApply={setAudience} />

      <AlertDialog open={!!imported} onOpenChange={(open) => !open && setImported(null)}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editor?.commands.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Replace what&apos;s here?</AlertDialogTitle>
            <AlertDialogDescription>
              This SOP already has content. Replace it with {imported?.name}, or add the document at the end. Ctrl+Z undoes either.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="outline" onClick={() => imported && applyImport(imported, "append")}>
              Add at the end
            </AlertDialogAction>
            <AlertDialogAction onClick={() => imported && applyImport(imported, "replace")}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
