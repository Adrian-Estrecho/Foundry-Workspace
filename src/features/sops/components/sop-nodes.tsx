"use client";

import * as React from "react";
import { Extension, Node, mergeAttributes } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { CheckIcon, ChevronDownIcon, RemoveFormattingIcon, Trash2Icon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CALLOUT_INFO, CALLOUT_VARIANTS, calloutVariant } from "../blocks";

/**
 * The SOP editor's own blocks. SopContent renders the same structure for
 * readers, and `.sop-prose` in globals.css styles both.
 */

/** What goes in an empty line, by what it is and what it's in. */
function hintFor(node: PMNode, parent: PMNode | null, emptyDoc: boolean) {
  if (node.type.name === "heading") return node.attrs.level === 3 ? "Subsection heading" : "Section heading";
  if (node.type.name !== "paragraph") return "";
  switch (parent?.type.name) {
    case "step":
      return "Describe this step";
    case "taskItem":
      return "Something to check";
    case "listItem":
      return "List item";
    case "callout":
      return CALLOUT_INFO[calloutVariant(parent.attrs.variant)].placeholder;
    case "blockquote":
      return "Quote";
    case "doc":
      return emptyDoc ? "Start writing, or add steps, checklists and notes from Insert" : "";
    default:
      return "";
  }
}

/**
 * Grey hint text in the empty line the cursor is on (`.is-empty` with
 * `data-placeholder`). Tiptap's Placeholder can't tell what the line is in
 * while a change is being applied, so this reads the new state itself.
 */
export const LineHint = Extension.create({
  name: "lineHint",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("lineHint"),
        props: {
          decorations: ({ doc, selection }) => {
            const { $from } = selection;
            const node = $from.parent;
            if (!selection.empty || !node.isTextblock || node.content.size > 0 || $from.depth === 0) return null;
            const emptyDoc = doc.childCount === 1 && doc.firstChild === node;
            const hint = hintFor(node, $from.node($from.depth - 1), emptyDoc);
            if (!hint) return null;
            const pos = $from.before();
            return DecorationSet.create(doc, [Decoration.node(pos, pos + node.nodeSize, { class: "is-empty", "data-placeholder": hint })]);
          },
        },
      }),
    ];
  },
});

/** A numbered step-by-step. Behaves like a list: Enter adds the next step, Enter on an empty one ends it. */
export const Steps = Node.create({
  name: "steps",
  group: "block list",
  content: "step+",
  parseHTML() {
    return [{ tag: 'ol[data-type="steps"]', priority: 100 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["ol", mergeAttributes(HTMLAttributes, { "data-type": "steps" }), 0];
  },
});

export const Step = Node.create({
  name: "step",
  content: "paragraph block*",
  defining: true,
  parseHTML() {
    return [{ tag: 'li[data-type="step"]', priority: 100 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["li", mergeAttributes(HTMLAttributes, { "data-type": "step" }), 0];
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      Tab: () => this.editor.commands.sinkListItem(this.name),
      "Shift-Tab": () => this.editor.commands.liftListItem(this.name),
    };
  },
});

/** A boxed note, tip, guideline, warning, do or don't. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      variant: {
        default: "note",
        parseHTML: (element) => calloutVariant(element.getAttribute("data-callout")),
        renderHTML: (attributes) => ({ "data-callout": attributes.variant }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'aside[data-type="callout"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["aside", mergeAttributes(HTMLAttributes, { "data-type": "callout" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView, {
      // The style menu belongs to the box, not to the text: keep the editor out of it.
      stopEvent: ({ event }) => event.target instanceof Element && !!event.target.closest("[data-callout-menu]"),
    });
  },
});

function CalloutView({ node, editor, getPos, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const variant = calloutVariant(node.attrs.variant);
  const { label, icon: Icon } = CALLOUT_INFO[variant];

  /** Takes the box away and leaves its text where it was. */
  const unwrap = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const current = tr.doc.nodeAt(pos);
        if (!current) return false;
        tr.replaceWith(pos, pos + current.nodeSize, current.content);
        return true;
      })
      .run();
  };

  return (
    <NodeViewWrapper as="aside" data-type="callout" data-callout={variant}>
      <div contentEditable={false} className="sop-callout-label">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-callout-menu=""
              aria-label={`${label} box: change its style`}
              className="-mx-1.5 -my-1 inline-flex items-center gap-[inherit] rounded-md px-1.5 py-1 outline-none hover:bg-[color-mix(in_oklab,var(--callout)_14%,transparent)] focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon aria-hidden="true" />
              {label}
              <ChevronDownIcon aria-hidden="true" className="opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-60"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              editor.commands.focus();
            }}
          >
            <DropdownMenuLabel>Box style</DropdownMenuLabel>
            {CALLOUT_VARIANTS.map((key) => {
              const Option = CALLOUT_INFO[key].icon;
              return (
                <DropdownMenuItem key={key} onSelect={() => updateAttributes({ variant: key })}>
                  <span data-callout={key} className="sop-swatch grid size-6 place-items-center rounded-md">
                    <Option className="size-3.5" />
                  </span>
                  <span className="flex-1">{CALLOUT_INFO[key].label}</span>
                  {key === variant && <CheckIcon className="text-muted-foreground" />}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={unwrap}>
              <RemoveFormattingIcon /> Remove box, keep text
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={deleteNode}>
              <Trash2Icon /> Delete box
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <NodeViewContent className="sop-callout-body" />
    </NodeViewWrapper>
  );
}
