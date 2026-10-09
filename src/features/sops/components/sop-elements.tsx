"use client";

import * as React from "react";
import type { Editor, JSONContent } from "@tiptap/react";
import {
  CodeXmlIcon,
  FootprintsIcon,
  Heading2Icon,
  Heading3Icon,
  LayoutTemplateIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PlusIcon,
  QuoteIcon,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CALLOUT_INFO, type CalloutVariant } from "../blocks";

/**
 * Ready-made pieces for an SOP (steps, checklists, notes, do's and don'ts),
 * added from the side panel or the Insert menu.
 */

type ElementKey =
  | "heading"
  | "subheading"
  | "steps"
  | "checklist"
  | "bulleted"
  | "numbered"
  | CalloutVariant
  | "quote"
  | "code"
  | "divider"
  | "outline";

type Element = { label: string; description: string; icon: LucideIcon; callout?: CalloutVariant };

const callout = (variant: CalloutVariant): Element => ({ ...CALLOUT_INFO[variant], callout: variant });

const ELEMENTS: Record<ElementKey, Element> = {
  heading: { label: "Section", description: "A heading that starts a section", icon: Heading2Icon },
  subheading: { label: "Subsection", description: "A smaller heading inside a section", icon: Heading3Icon },
  steps: { label: "Step by step", description: "Numbered steps, in order", icon: FootprintsIcon },
  checklist: { label: "Checklist", description: "Things to tick off", icon: ListChecksIcon },
  bulleted: { label: "Bulleted list", description: "Points in no set order", icon: ListIcon },
  numbered: { label: "Numbered list", description: "A simple numbered list", icon: ListOrderedIcon },
  note: callout("note"),
  tip: callout("tip"),
  guideline: callout("guideline"),
  important: callout("important"),
  warning: callout("warning"),
  do: callout("do"),
  dont: callout("dont"),
  quote: { label: "Quote", description: "Words from a client or lead", icon: QuoteIcon },
  code: { label: "File path or code", description: "Folder names, presets, scripts", icon: CodeXmlIcon },
  divider: { label: "Divider", description: "A line between parts", icon: MinusIcon },
  outline: { label: "SOP outline", description: "Purpose, steps, checks: fill it in", icon: LayoutTemplateIcon },
};

const GROUPS: { title: string; keys: ElementKey[] }[] = [
  { title: "Structure", keys: ["heading", "subheading", "steps", "checklist", "bulleted", "numbered"] },
  { title: "Callouts", keys: ["note", "tip", "guideline", "important", "warning"] },
  { title: "Rules", keys: ["do", "dont"] },
  { title: "More", keys: ["quote", "code", "divider"] },
  { title: "Templates", keys: ["outline"] },
];

const text = (value: string, bold = false): JSONContent => ({ type: "text", text: value, ...(bold && { marks: [{ type: "bold" }] }) });
const p = (...content: JSONContent[]): JSONContent => (content.length ? { type: "paragraph", content } : { type: "paragraph" });
const box = (variant: CalloutVariant, ...content: JSONContent[]): JSONContent => ({ type: "callout", attrs: { variant }, content: [p(...content)] });
const h2 = (value: string): JSONContent => ({ type: "heading", attrs: { level: 2 }, content: [text(value)] });
const step = (title: string, detail: string): JSONContent => ({ type: "step", content: [p(text(title, true), text(` ${detail}`))] });
const check = (value: string): JSONContent => ({ type: "taskItem", attrs: { checked: false }, content: [p(text(value))] });

/** A starting point for a whole SOP, written for an editing team. */
const OUTLINE: JSONContent[] = [
  h2("Purpose"),
  p(text("Why this SOP exists and when to use it.")),
  h2("Before you start"),
  { type: "taskList", content: [check("Access to the client's project folder"), check("The brief and any reference links")] },
  h2("Steps"),
  {
    type: "steps",
    content: [
      step("Set up the project.", "Create the folders and import the footage."),
      step("Build the first cut.", "Follow the brief and keep to the agreed length."),
      step("Export and deliver.", "Use the delivery preset and upload the file for review."),
    ],
  },
  box("tip", text("Save your own presets so the next project starts faster.")),
  h2("Quality check"),
  box("do", text("Watch the full export once before you send it.")),
  box("dont", text("Send a cut you haven't checked for audio levels.")),
  h2("Who to ask"),
  p(text("Who to contact when something isn't clear, and where.")),
];

function contentFor(key: ElementKey): JSONContent | JSONContent[] {
  switch (key) {
    case "heading":
      return { type: "heading", attrs: { level: 2 } };
    case "subheading":
      return { type: "heading", attrs: { level: 3 } };
    case "steps":
      return { type: "steps", content: [{ type: "step", content: [p()] }] };
    case "checklist":
      return { type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [p()] }] };
    case "bulleted":
      return { type: "bulletList", content: [{ type: "listItem", content: [p()] }] };
    case "numbered":
      return { type: "orderedList", content: [{ type: "listItem", content: [p()] }] };
    case "quote":
      return { type: "blockquote", content: [p()] };
    case "code":
      return { type: "codeBlock" };
    case "divider":
      return [{ type: "horizontalRule" }, p()];
    case "outline":
      return OUTLINE;
    default:
      return box(key);
  }
}

/** Editors that the writer has clicked into, so an insert goes where their cursor is. */
const placed = new WeakSet<Editor>();
export const markPlaced = (editor: Editor) => void placed.add(editor);

/**
 * Adds an element below the block the cursor is in (or at the end, before
 * the writer has clicked into the text). An empty line is replaced instead.
 */
export function insertElement(editor: Editor, key: ElementKey) {
  const { doc, selection } = editor.state;
  let start: number;
  let end: number;
  let target = null;
  if (!placed.has(editor)) {
    target = doc.lastChild;
    end = doc.content.size;
    start = end - (target?.nodeSize ?? 0);
  } else if (selection.$from.depth > 0) {
    target = selection.$from.node(1);
    start = selection.$from.before(1);
    end = selection.$from.after(1);
  } else {
    start = end = selection.to;
  }
  const replace = target?.type.name === "paragraph" && target.content.size === 0;
  editor
    .chain()
    .focus()
    .insertContentAt(replace ? { from: start, to: end } : end, contentFor(key))
    .scrollIntoView()
    .run();
}

function ElementIcon({ element, className }: { element: Element; className?: string }) {
  const Icon = element.icon;
  return element.callout ? (
    <span data-callout={element.callout} className={`sop-swatch grid place-items-center rounded-lg ${className}`}>
      <Icon className="size-4" />
    </span>
  ) : (
    <span className={`grid place-items-center rounded-lg bg-primary/12 text-primary ${className}`}>
      <Icon className="size-4" />
    </span>
  );
}

/** The side panel of elements (wide screens). */
export function ElementPalette({ editor }: { editor: Editor | null }) {
  return (
    <div className="grid gap-5">
      {GROUPS.map((group) => (
        <div key={group.title} className="grid gap-0.5">
          <p className="px-2 pb-1.5 text-xs font-medium text-muted-foreground">{group.title}</p>
          {group.keys.map((key) => {
            const element = ELEMENTS[key];
            return (
              <button
                key={key}
                type="button"
                disabled={!editor}
                // Keep the cursor in the text, so the element lands where it is.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor && insertElement(editor, key)}
                className="group flex items-center gap-3 rounded-lg p-2 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <ElementIcon element={element} className="size-8 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{element.label}</span>
                  <span className="block text-xs text-muted-foreground">{element.description}</span>
                </span>
                <PlusIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** The same elements as a menu, for the toolbar on smaller screens. */
export function InsertMenu({ editor, children }: { editor: Editor; children: React.ReactNode }) {
  const inserted = React.useRef(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[min(32rem,var(--radix-dropdown-menu-content-available-height))] w-64 overflow-y-auto"
        onCloseAutoFocus={(event) => {
          // After an insert, go back to the text: the cursor is in the new element.
          if (!inserted.current) return;
          inserted.current = false;
          event.preventDefault();
          editor.commands.focus();
        }}
      >
        {GROUPS.map((group, index) => (
          <DropdownMenuGroup key={group.title}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{group.title}</DropdownMenuLabel>
            {group.keys.map((key) => (
              <DropdownMenuItem
                key={key}
                onSelect={() => {
                  inserted.current = true;
                  insertElement(editor, key);
                }}
              >
                <ElementIcon element={ELEMENTS[key]} className="size-7" />
                {ELEMENTS[key].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
