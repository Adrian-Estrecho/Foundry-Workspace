"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeftIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  GripVerticalIcon,
  InfoIcon,
  Loader2Icon,
  LockIcon,
  MonitorIcon,
  MousePointerClickIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SmartphoneIcon,
  Trash2Icon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { FormRow, NativeSelect } from "@/components/shared/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { resetForm, saveForm } from "../actions";
import {
  ADDABLE_TYPES,
  BUILTINS,
  FIELD_TYPE_INFO,
  FORM_KINDS,
  FORM_NAMES,
  MAX_OPTIONS,
  PLACEHOLDER_TYPES,
  builtinOf,
  isChoice,
  newFieldId,
  type BuiltinField,
  type FieldType,
  type FormField,
  type FormKind,
} from "../fields";
import { FieldControl } from "./field-control";
import { FIELD_ICONS } from "./field-icons";
import { FormFields } from "./form-fields";

const HANDLES = ["-top-1 -left-1", "-top-1 -right-1", "-bottom-1 -left-1", "-bottom-1 -right-1"];
const SUBMIT_LABELS: Record<FormKind, string> = { apply: "Send application", intake: "Send project details" };
const TAB_LABELS: Record<FormKind, string> = { apply: "Application", intake: "Project request" };

function blankField(type: FieldType): FormField {
  const field: FormField = { id: newFieldId(type), type, label: type === "section" ? "New section" : "Untitled question" };
  if (type !== "section") field.required = false;
  if (isChoice(type)) field.options = ["Option 1", "Option 2"];
  return field;
}

const copyOf = (field: FormField): FormField => ({ ...field, options: field.options && [...field.options] });

/** The first thing that would stop a save, caught before sending it. */
function firstProblem(kind: FormKind, fields: FormField[]): { id: string | null; message: string } | null {
  for (const field of fields) {
    if (!field.label.trim()) return { id: field.id, message: "Every question needs a label." };
    const editable = isChoice(field.type) && (builtinOf(kind, field.id)?.optionsEditable ?? true);
    if (!editable) continue;
    const options = (field.options ?? []).map((o) => o.trim());
    if (options.length === 0 || options.some((o) => !o)) {
      return { id: field.id, message: `Fill in or remove the empty options in "${field.label}".` };
    }
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
      return { id: field.id, message: `"${field.label}" has the same option twice.` };
    }
  }
  if (!fields.some((f) => f.type !== "section")) return { id: null, message: "Keep at least one question on the form." };
  return null;
}

/**
 * Full-screen editor for a public form: add questions from the palette,
 * drag them into order, and change each one in the inspector. Preview shows
 * the form as visitors get it, on a desktop or a phone. Nothing reaches the
 * live form until it's saved.
 */
export function FormBuilder({
  kind,
  initialFields,
  publicUrl,
  workspaceName,
}: {
  kind: FormKind;
  initialFields: FormField[];
  publicUrl: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(initialFields);
  const [fields, setFields] = React.useState(initialFields);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"edit" | "preview">("edit");
  const [device, setDevice] = React.useState<"desktop" | "phone">("desktop");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const dndId = React.useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dirty = React.useMemo(() => JSON.stringify(fields) !== JSON.stringify(saved), [fields, saved]);
  const selected = fields.find((f) => f.id === selectedId) ?? null;
  const dragged = fields.find((f) => f.id === dragId) ?? null;
  const missing = BUILTINS[kind].filter((b) => !fields.some((f) => f.id === b.field.id));
  const questions = fields.filter((f) => f.type !== "section");
  const ownQuestions = questions.filter((f) => !builtinOf(kind, f.id)).length;

  const reveal = (id: string) =>
    requestAnimationFrame(() => document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));

  const update = (id: string, patch: Partial<FormField>) =>
    setFields((all) => all.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  /** Puts a field after `after` (the end when null), selects it and scrolls to it. */
  const insert = (field: FormField, after: string | null) => {
    setFields((all) => {
      const index = after ? all.findIndex((f) => f.id === after) : -1;
      const next = [...all];
      next.splice(index === -1 ? all.length : index + 1, 0, field);
      return next;
    });
    setSelectedId(field.id);
    setMode("edit");
    reveal(field.id);
  };
  const add = (type: FieldType, after: string | null) => insert(blankField(type), after);
  const addBuiltin = (builtin: BuiltinField, after: string | null) => insert(copyOf(builtin.field), after);
  const duplicate = (field: FormField) =>
    insert({ ...copyOf(field), id: newFieldId(field.type), label: `${field.label} (copy)` }, field.id);

  const remove = (id: string) => {
    const index = fields.findIndex((f) => f.id === id);
    const next = fields.filter((f) => f.id !== id);
    setFields(next);
    if (selectedId === id) setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? null);
  };

  const changeType = (field: FormField, type: FieldType) => {
    const next: FormField = { ...field, type };
    if (isChoice(type)) next.options = field.options?.length ? field.options : ["Option 1", "Option 2"];
    else delete next.options;
    if (!PLACEHOLDER_TYPES.includes(type)) delete next.placeholder;
    setFields((all) => all.map((f) => (f.id === field.id ? next : f)));
  };

  const save = () => {
    if (!dirty || pending) return;
    const problem = firstProblem(kind, fields);
    if (problem) {
      toast.error(problem.message);
      if (problem.id) {
        setSelectedId(problem.id);
        setMode("edit");
        reveal(problem.id);
      }
      return;
    }
    startTransition(async () => {
      const result = await saveForm(kind, fields);
      if (!result.ok) return void toast.error(result.error);
      setSaved(result.data.fields);
      setFields(result.data.fields);
      toast.success("Form saved. It's live now.");
      router.refresh();
    });
  };

  const reset = () =>
    startTransition(async () => {
      const result = await resetForm(kind);
      if (!result.ok) return void toast.error(result.error);
      setSaved(result.data.fields);
      setFields(result.data.fields);
      setSelectedId(null);
      toast.success("Back to the standard form");
      router.refresh();
    });

  // Ctrl/⌘+S saves; leaving with unsaved edits asks first.
  const saveRef = React.useRef(save);
  React.useEffect(() => {
    saveRef.current = save;
  });
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const leaveGuard = (event: React.MouseEvent) => {
    if (dirty && !window.confirm("You have unsaved changes to this form. Leave without saving them?")) event.preventDefault();
  };

  const onDragStart = ({ active }: DragStartEvent) => setDragId(String(active.id));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragId(null);
    if (!over || active.id === over.id) return;
    setFields((all) => {
      const from = all.findIndex((f) => f.id === active.id);
      const to = all.findIndex((f) => f.id === over.id);
      return from < 0 || to < 0 ? all : arrayMove(all, from, to);
    });
  };

  const inspector = (field: FormField) => (
    <Inspector
      kind={kind}
      field={field}
      onChange={(patch) => update(field.id, patch)}
      onChangeType={(type) => changeType(field, type)}
      onDuplicate={() => duplicate(field)}
      onRemove={() => remove(field.id)}
    />
  );

  return (
    <div className="-mx-4 -mt-6 -mb-12 flex flex-col sm:-mx-6 lg:-mx-8 lg:h-[calc(100dvh-3.5rem)]">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b bg-background px-4 py-3 sm:px-6">
        <Button asChild variant="ghost" size="icon" aria-label="Back to workspace settings">
          <Link href="/workspace#forms" onClick={leaveGuard}>
            <ArrowLeftIcon />
          </Link>
        </Button>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">Forms · {workspaceName}</p>
          <h1 className="font-heading text-lg leading-tight font-semibold tracking-tight">{FORM_NAMES[kind]}</h1>
        </div>
        <nav aria-label="Forms" className="inline-flex rounded-lg bg-muted p-0.5">
          {FORM_KINDS.map((k) => (
            <Link
              key={k}
              href={`/workspace/forms/${k}`}
              onClick={leaveGuard}
              aria-current={k === kind ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                k === kind ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TAB_LABELS[k]}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:inline-flex" aria-live="polite">
            <span className={cn("size-1.5 rounded-full", dirty ? "bg-warning" : "bg-success")} aria-hidden="true" />
            {dirty ? "Unsaved changes" : "Saved · live"}
          </span>
          <Segmented
            label="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "edit", label: "Edit", icon: PencilIcon },
              { value: "preview", label: "Preview", icon: EyeIcon },
            ]}
          />
          <Button asChild variant="ghost" size="icon" aria-label="Open the live form">
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLinkIcon />
            </a>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Reset to the standard form" disabled={pending}>
                <RotateCcwIcon />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset to the standard form?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your own questions go, and the standard ones come back with their original wording. Answers people
                  already sent are kept.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={reset}>
                  Reset form
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={save} disabled={!dirty || pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Save
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_21rem]">
        <aside aria-label="Add questions" className="hidden overflow-y-auto border-r p-3 lg:block">
          <Palette missing={missing} onAdd={(type) => add(type, selectedId)} onAddBuiltin={(b) => addBuiltin(b, selectedId)} />
        </aside>

        <div className="min-w-0 overflow-y-auto">
          {mode === "edit" ? (
            <div className="mx-auto grid max-w-3xl gap-3 px-4 py-6 sm:px-6 lg:py-8">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {questions.length} questions{ownQuestions > 0 && ` · ${ownQuestions} of your own`} · drag{" "}
                  <GripVerticalIcon className="inline size-3.5 align-[-2px]" aria-hidden="true" /> to reorder
                </p>
                <AddMenu missing={missing} onAdd={(type) => add(type, selectedId)} onAddBuiltin={(b) => addBuiltin(b, selectedId)}>
                  <Button variant="secondary" size="sm" className="lg:hidden">
                    <PlusIcon /> Add
                  </Button>
                </AddMenu>
              </div>

              <DndContext
                id={dndId}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragCancel={() => setDragId(null)}
              >
                <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                  {fields.map((field) => (
                    <FieldCard
                      key={field.id}
                      kind={kind}
                      field={field}
                      selected={field.id === selectedId}
                      onSelect={() => setSelectedId(field.id)}
                      onDuplicate={() => duplicate(field)}
                      onRemove={() => remove(field.id)}
                    >
                      {field.id === selectedId && <div className="border-t p-4 xl:hidden">{inspector(field)}</div>}
                    </FieldCard>
                  ))}
                </SortableContext>
                <DragOverlay>{dragged && <DragPreview field={dragged} />}</DragOverlay>
              </DndContext>

              <AddMenu missing={missing} onAdd={(type) => add(type, null)} onAddBuiltin={(b) => addBuiltin(b, null)}>
                <button
                  type="button"
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium text-muted-foreground transition-colors outline-none hover:border-primary/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <PlusIcon className="size-4" /> Add a question
                </button>
              </AddMenu>
            </div>
          ) : (
            <div className="px-4 py-6 sm:px-6 lg:py-8">
              <div className="mb-4 flex justify-center">
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
              <div className={cn("mx-auto transition-[max-width] duration-300", device === "phone" ? "max-w-[390px]" : "max-w-3xl")}>
                <div inert className="@container grid gap-8 rounded-xl border bg-card p-6 sm:p-8">
                  <FormFields kind={kind} fields={fields} />
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                      <span className="text-primary">*</span> Required
                    </p>
                    <Button size="lg" className="min-w-48">
                      {SUBMIT_LABELS[kind]}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside aria-label="Question settings" className="hidden overflow-y-auto border-l p-5 xl:block">
          {selected ? (
            inspector(selected)
          ) : (
            <div className="grid place-items-center gap-3 px-2 py-16 text-center">
              <span className="grid size-10 place-items-center rounded-lg bg-muted">
                <MousePointerClickIcon className="size-5 text-muted-foreground" />
              </span>
              <div>
                <p className="font-medium">Pick a question</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Click a question on the form to change its wording, options, or whether it&apos;s required.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function FieldCard({
  kind,
  field,
  selected,
  onSelect,
  onDuplicate,
  onRemove,
  children,
}: {
  kind: FormKind;
  field: FormField;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const builtin = builtinOf(kind, field.id);
  const Icon = FIELD_ICONS[field.type];
  const section = field.type === "section";
  const stop = (action: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    action();
  };

  return (
    <div
      ref={setNodeRef}
      id={`card-${field.id}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={onSelect}
      className={cn(
        "group relative scroll-my-24 rounded-xl border transition-[border-color,opacity]",
        section ? "mt-3 bg-transparent first:mt-0" : "bg-card",
        selected ? "border-transparent outline-[1.5px] outline-primary" : "hover:border-primary/40",
        section && !selected && "border-dashed",
        isDragging && "opacity-40",
      )}
    >
      {selected &&
        HANDLES.map((position) => (
          <span
            key={position}
            aria-hidden="true"
            className={cn("absolute z-10 size-2.5 rounded-[3px] border-[1.5px] border-primary bg-card", position)}
          />
        ))}

      <div className="flex items-center gap-1.5 px-2.5 pt-2 text-xs text-muted-foreground">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Move “${field.label}”`}
          className="grid size-7 cursor-grab touch-none place-items-center rounded-md outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={stop(onSelect)}
          aria-label={`Edit “${field.label}”`}
          aria-pressed={selected}
          className="inline-flex min-w-0 items-center gap-1.5 rounded px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate">{FIELD_TYPE_INFO[field.type].label}</span>
        </button>
        {builtin?.locked && (
          <Tag>
            <LockIcon className="size-3" /> Always on
          </Tag>
        )}
        {builtin && !builtin.locked && <Tag>Standard</Tag>}
        {field.required && <Tag accent>Required</Tag>}
        <div
          className={cn(
            "ml-auto flex gap-0.5 transition-opacity",
            selected ? "opacity-100" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
          )}
        >
          {!builtin && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={stop(onDuplicate)} aria-label={`Duplicate “${field.label}”`}>
              <CopyIcon />
            </Button>
          )}
          {!builtin?.locked && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={stop(onRemove)} aria-label={`Remove “${field.label}”`}>
              <Trash2Icon />
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 pt-1.5 pb-4">
        {section ? (
          <div>
            <p className="font-heading text-lg font-medium">{field.label}</p>
            {field.help && <p className="mt-0.5 text-sm text-muted-foreground">{field.help}</p>}
          </div>
        ) : (
          <div inert className="grid">
            <FieldControl field={field} rules={builtin} />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function DragPreview({ field }: { field: FormField }) {
  const Icon = FIELD_ICONS[field.type];
  return (
    <div className="flex cursor-grabbing items-center gap-2.5 rounded-xl border bg-card px-3 py-3 shadow-lg ring-[1.5px] ring-primary">
      <GripVerticalIcon className="size-4 text-muted-foreground" />
      <Icon className="size-4 text-primary" />
      <span className="truncate text-sm font-medium">{field.label}</span>
    </div>
  );
}

function Tag({ accent, children }: { accent?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        accent ? "bg-primary/12 text-primary" : "bg-muted",
      )}
    >
      {children}
    </span>
  );
}

function Palette({
  missing,
  onAdd,
  onAddBuiltin,
}: {
  missing: BuiltinField[];
  onAdd: (type: FieldType) => void;
  onAddBuiltin: (builtin: BuiltinField) => void;
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-0.5">
        <p className="px-2 pb-1.5 text-xs font-medium text-muted-foreground">Add a question</p>
        {ADDABLE_TYPES.map((type) => {
          const Icon = FIELD_ICONS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => onAdd(type)}
              className="group flex items-center gap-3 rounded-lg p-2 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{FIELD_TYPE_INFO[type].label}</span>
                <span className="block text-xs text-muted-foreground">{FIELD_TYPE_INFO[type].description}</span>
              </span>
              <PlusIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          );
        })}
      </div>

      {missing.length > 0 && (
        <div className="grid gap-0.5">
          <p className="px-2 text-xs font-medium text-muted-foreground">Standard questions</p>
          <p className="px-2 pb-1.5 text-xs text-muted-foreground">Taken off this form. Add them back any time.</p>
          {missing.map((builtin) => {
            const Icon = FIELD_ICONS[builtin.field.type];
            return (
              <button
                key={builtin.field.id}
                type="button"
                onClick={() => onAddBuiltin(builtin)}
                className="group flex items-center gap-3 rounded-lg p-2 text-left text-sm transition-colors outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{builtin.field.label}</span>
                <PlusIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddMenu({
  missing,
  onAdd,
  onAddBuiltin,
  children,
}: {
  missing: BuiltinField[];
  onAdd: (type: FieldType) => void;
  onAddBuiltin: (builtin: BuiltinField) => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-60">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Add a question</DropdownMenuLabel>
        {ADDABLE_TYPES.map((type) => {
          const Icon = FIELD_ICONS[type];
          return (
            <DropdownMenuItem key={type} onSelect={() => onAdd(type)}>
              <Icon /> {FIELD_TYPE_INFO[type].label}
            </DropdownMenuItem>
          );
        })}
        {missing.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Standard questions</DropdownMenuLabel>
            {missing.map((builtin) => (
              <DropdownMenuItem key={builtin.field.id} onSelect={() => onAddBuiltin(builtin)}>
                <PlusIcon /> {builtin.field.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Inspector({
  kind,
  field,
  onChange,
  onChangeType,
  onDuplicate,
  onRemove,
}: {
  kind: FormKind;
  field: FormField;
  onChange: (patch: Partial<FormField>) => void;
  onChangeType: (type: FieldType) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const builtin = builtinOf(kind, field.id);
  const Icon = FIELD_ICONS[field.type];
  const section = field.type === "section";
  const optionsEditable = isChoice(field.type) && (!builtin || builtin.optionsEditable);

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{FIELD_TYPE_INFO[field.type].label}</p>
          <p className="text-xs text-muted-foreground">
            {builtin ? "Standard question" : section ? "Section heading" : "Your own question"}
          </p>
        </div>
      </div>

      {builtin && (
        <p className="flex gap-2 rounded-lg bg-surface p-3 text-xs text-muted-foreground ring-1 ring-border">
          {builtin.locked ? <LockIcon className="size-3.5 shrink-0" /> : <InfoIcon className="size-3.5 shrink-0" />}
          <span>
            {builtin.note}
            {builtin.locked && " It's always on the form and always required."}
          </span>
        </p>
      )}

      {!builtin && !section && (
        <FormRow label="Answer type">
          <NativeSelect value={field.type} onChange={(event) => onChangeType(event.target.value as FieldType)}>
            {ADDABLE_TYPES.filter((type) => type !== "section").map((type) => (
              <option key={type} value={type}>
                {FIELD_TYPE_INFO[type].label}
              </option>
            ))}
          </NativeSelect>
        </FormRow>
      )}

      <FormRow label={section ? "Heading" : "Question"}>
        <Input value={field.label} onChange={(event) => onChange({ label: event.target.value })} maxLength={120} />
      </FormRow>
      <FormRow label={section ? "Description" : "Help text"} hint="Optional. Shown under it in smaller text.">
        <Textarea
          value={field.help ?? ""}
          onChange={(event) => onChange({ help: event.target.value || undefined })}
          rows={2}
          maxLength={300}
          className="rounded-xl"
        />
      </FormRow>
      {PLACEHOLDER_TYPES.includes(field.type) && (
        <FormRow label="Placeholder" hint="Example text inside the empty box.">
          <Input
            value={field.placeholder ?? ""}
            onChange={(event) => onChange({ placeholder: event.target.value || undefined })}
            maxLength={200}
          />
        </FormRow>
      )}

      {optionsEditable && <OptionsEditor options={field.options ?? []} onChange={(options) => onChange({ options })} />}

      {!section && (
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-surface p-3 ring-1 ring-border">
          <span>
            <span className="block text-sm font-medium">Required</span>
            <span className="block text-xs text-muted-foreground">
              {builtin?.locked ? "Always required." : "They can't send the form without it."}
            </span>
          </span>
          <Switch
            checked={Boolean(field.required)}
            disabled={builtin?.locked}
            onCheckedChange={(required) => onChange({ required })}
          />
        </label>
      )}

      {!builtin?.locked && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {!builtin && (
            <Button type="button" variant="secondary" size="sm" onClick={onDuplicate}>
              <CopyIcon /> Duplicate
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-danger hover:text-danger">
            <Trash2Icon /> {builtin ? "Take off the form" : "Delete"}
          </Button>
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  const list = React.useRef<HTMLDivElement>(null);
  const focus = (index: number) =>
    requestAnimationFrame(() => list.current?.querySelectorAll<HTMLInputElement>("input")[index]?.focus());
  const set = (index: number, value: string) => onChange(options.map((o, i) => (i === index ? value : o)));
  const addAt = (index: number) => {
    if (options.length >= MAX_OPTIONS) return;
    const next = [...options];
    next.splice(index, 0, "");
    onChange(next);
    focus(index);
  };
  const removeAt = (index: number) => onChange(options.filter((_, i) => i !== index));

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Options</p>
      <div ref={list} className="grid gap-1.5">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular">{index + 1}</span>
            <Input
              value={option}
              onChange={(event) => set(index, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addAt(index + 1);
                } else if (event.key === "Backspace" && option === "" && options.length > 1) {
                  event.preventDefault();
                  removeAt(index);
                  focus(Math.max(0, index - 1));
                }
              }}
              maxLength={80}
              placeholder={`Option ${index + 1}`}
              aria-label={`Option ${index + 1}`}
              aria-invalid={option.trim() === "" ? true : undefined}
              className="h-8"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removeAt(index)}
              disabled={options.length <= 1}
              aria-label={`Remove option ${index + 1}`}
            >
              <XIcon />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => addAt(options.length)} disabled={options.length >= MAX_OPTIONS}>
          <PlusIcon /> Add option
        </Button>
        <span className="text-xs text-muted-foreground">Enter adds another</span>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon: LucideIcon }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <option.icon className="size-3.5" />
          {option.label}
        </button>
      ))}
    </div>
  );
}
