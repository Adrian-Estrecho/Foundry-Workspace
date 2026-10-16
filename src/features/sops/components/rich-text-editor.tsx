"use client";

import * as React from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { toast } from "sonner";
import {
  BetweenHorizontalEndIcon,
  BetweenHorizontalStartIcon,
  BetweenVerticalEndIcon,
  BetweenVerticalStartIcon,
  BoldIcon,
  CheckIcon,
  CodeIcon,
  Columns3Icon,
  FootprintsIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PanelTopIcon,
  PlusIcon,
  QuoteIcon,
  Redo2Icon,
  Rows3Icon,
  StrikethroughIcon,
  TableCellsMergeIcon,
  TableCellsSplitIcon,
  TableIcon,
  Trash2Icon,
  UnderlineIcon,
  Undo2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database";
import { describeImport, tidySop } from "../import";
import { InsertMenu, insertElement, markPlaced } from "./sop-elements";
import { Callout, LineHint, Step, Steps } from "./sop-nodes";

/**
 * Rich text for SOPs: headings, lists, quotes, code, links and tables, plus
 * the SOP blocks (step by step, checklists and callout boxes). The document
 * is Tiptap JSON, which SopContent renders for readers.
 */

/**
 * The SOP editor. Read the document with `editor.getJSON()` when saving.
 * Pasted documents are laid out as an SOP (see import.ts); a file dropped on
 * the page goes to `onFile`.
 */
export function useSopEditor({ initial, label, onFile }: { initial: Json | null; label: string; onFile?: (file: File) => void }) {
  const fileHandler = React.useRef(onFile);
  React.useEffect(() => {
    fileHandler.current = onFile;
  });

  return useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto"] },
        listKeymap: {
          listTypes: [
            { itemName: "listItem", wrapperNames: ["bulletList", "orderedList"] },
            { itemName: "taskItem", wrapperNames: ["taskList"] },
            { itemName: "step", wrapperNames: ["steps"] },
          ],
        },
      }),
      TaskList,
      TaskItem,
      Steps,
      Step,
      Callout,
      TableKit.configure({ table: { resizable: false } }),
      LineHint,
    ],
    content: (initial as object | null) ?? "",
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        class: "sop-prose min-h-[28rem] px-5 py-5 outline-none sm:px-8 sm:py-7",
      },
      transformPastedHTML: (html) => {
        // Copied from this editor: it's laid out already.
        if (html.includes("data-pm-slice")) return html;
        const { html: tidy, counts } = tidySop(html);
        if (counts.images) toast(`${counts.images === 1 ? "A picture was" : "Pictures were"} left out: SOPs don't hold pictures yet.`);
        return tidy;
      },
      handleDrop: (_view, event) => {
        const file = event.dataTransfer?.files[0];
        if (!file) return false;
        // Otherwise the browser opens the file in place of the editor.
        event.preventDefault();
        fileHandler.current?.(file);
        return true;
      },
    },
    onFocus: ({ editor }) => markPlaced(editor),
  });
}

/** The toolbar and the page to write on. */
export function SopEditor({ editor }: { editor: Editor | null }) {
  return (
    <div className="rounded-xl border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {editor ? <Toolbar editor={editor} /> : <div className="h-11 rounded-t-xl border-b bg-surface" />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      code: editor.isActive("code"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      task: editor.isActive("taskList"),
      steps: editor.isActive("steps"),
      quote: editor.isActive("blockquote"),
      link: editor.isActive("link"),
      table: editor.isActive("table"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b bg-surface p-1.5 lg:top-0"
    >
      <InsertMenu editor={editor}>
        <Button type="button" variant="secondary" size="sm" className="mr-1 lg:hidden">
          <PlusIcon /> Insert
        </Button>
      </InsertMenu>
      <Tool label="Section heading" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} icon={Heading2Icon} />
      <Tool label="Subsection heading" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} icon={Heading3Icon} />
      <Divider />
      <Tool label="Bold" shortcut="Ctrl+B" active={state.bold} onClick={() => chain().toggleBold().run()} icon={BoldIcon} />
      <Tool label="Italic" shortcut="Ctrl+I" active={state.italic} onClick={() => chain().toggleItalic().run()} icon={ItalicIcon} />
      <Tool label="Underline" shortcut="Ctrl+U" active={state.underline} onClick={() => chain().toggleUnderline().run()} icon={UnderlineIcon} />
      <Tool label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()} icon={StrikethroughIcon} />
      <Tool label="Inline code" active={state.code} onClick={() => chain().toggleCode().run()} icon={CodeIcon} />
      <LinkTool editor={editor} active={state.link} />
      <Divider />
      <Tool label="Step by step" active={state.steps} onClick={() => chain().toggleList("steps", "step").run()} icon={FootprintsIcon} />
      <Tool label="Checklist" active={state.task} onClick={() => chain().toggleTaskList().run()} icon={ListChecksIcon} />
      <Tool label="Bulleted list" active={state.bullet} onClick={() => chain().toggleBulletList().run()} icon={ListIcon} />
      <Tool label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()} icon={ListOrderedIcon} />
      <Tool label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()} icon={QuoteIcon} />
      <Tool label="Divider line" onClick={() => chain().setHorizontalRule().run()} icon={MinusIcon} />
      {state.table ? <TableMenu editor={editor} /> : <Tool label="Table" onClick={() => insertElement(editor, "table")} icon={TableIcon} />}
      <Divider />
      <Tool label="Tidy up: notes, steps and checklists as SOP blocks" onClick={() => tidyUp(editor)} icon={WandSparklesIcon} />
      <Tool label="Undo" shortcut="Ctrl+Z" disabled={!state.canUndo} onClick={() => chain().undo().run()} icon={Undo2Icon} />
      <Tool label="Redo" shortcut="Ctrl+Shift+Z" disabled={!state.canRedo} onClick={() => chain().redo().run()} icon={Redo2Icon} />
    </div>
  );
}

/** Lays out what's on the page again, as an import would (for text pasted in before, say). */
function tidyUp(editor: Editor) {
  const { html, counts } = tidySop(editor.getHTML());
  editor.chain().focus().setContent(html).run();
  toast.success("Tidied up", { description: `${describeImport(counts)} Ctrl+Z puts it back.` });
}

/** Whether the table the cursor is in starts with a header row. */
function inHeaderTable(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "table") return node.firstChild?.firstChild?.type.name === "tableHeader";
  }
  return false;
}

/** Rows, columns, header and cells of the table the cursor is in. */
function TableMenu({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({ header: inHeaderTable(editor), canMerge: editor.can().mergeCells(), canSplit: editor.can().splitCell() }),
  });
  const chain = () => editor.chain().focus();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Table options" className="bg-accent text-foreground">
              <TableIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Table options</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        className="w-56"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.commands.focus();
        }}
      >
        <DropdownMenuItem onSelect={() => chain().addRowBefore().run()}>
          <BetweenHorizontalStartIcon /> Add row above
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => chain().addRowAfter().run()}>
          <BetweenHorizontalEndIcon /> Add row below
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => chain().addColumnBefore().run()}>
          <BetweenVerticalStartIcon /> Add column left
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => chain().addColumnAfter().run()}>
          <BetweenVerticalEndIcon /> Add column right
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => chain().toggleHeaderRow().run()}>
          <PanelTopIcon /> <span className="flex-1">Header row</span>
          {state.header && <CheckIcon className="text-muted-foreground" />}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!state.canMerge} onSelect={() => chain().mergeCells().run()}>
          <TableCellsMergeIcon /> Merge cells
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!state.canSplit} onSelect={() => chain().splitCell().run()}>
          <TableCellsSplitIcon /> Split cell
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => chain().deleteRow().run()}>
          <Rows3Icon /> Delete row
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => chain().deleteColumn().run()}>
          <Columns3Icon /> Delete column
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => chain().deleteTable().run()}>
          <Trash2Icon /> Delete table
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />;

function Tool({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  icon: Icon,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={cn(active && "bg-accent text-foreground")}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-1.5 opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function LinkTool({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [href, setHref] = React.useState("");

  const openChange = (value: boolean) => {
    setOpen(value);
    if (value) setHref((editor.getAttributes("link").href as string | undefined) ?? "");
  };

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    // React bubbles the submit through the popover's portal to the SOP form, which would save it.
    event.stopPropagation();
    const url = href.trim();
    if (!url) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else {
      const safe = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Link" aria-pressed={active} className={cn(active && "bg-accent text-foreground")}>
          <LinkIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form onSubmit={apply} className="grid gap-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Link
            <Input value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://…" autoFocus />
          </label>
          <div className="flex justify-end gap-2">
            {active && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  setOpen(false);
                }}
              >
                Remove
              </Button>
            )}
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
