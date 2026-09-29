"use client";

import * as React from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  CodeIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database";

/**
 * Rich text for SOPs: headings, lists, quotes, code and links. Saves the
 * document as JSON through a hidden input named `name`, which SopContent
 * renders for readers.
 */
export function RichTextEditor({ name, initial, label }: { name: string; initial: Json | null; label: string }) {
  const [value, setValue] = React.useState(() => JSON.stringify(initial ?? { type: "doc", content: [] }));

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto"] },
      }),
    ],
    content: (initial as object | null) ?? "",
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        class: cn(
          "min-h-80 px-4 py-3 text-sm leading-relaxed outline-none",
          "[&_p]:my-2 [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-medium [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:font-medium",
          "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li>p]:my-0.5",
          "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
          "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_pre_code]:bg-transparent [&_pre_code]:p-0",
          "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_hr]:my-4 [&_hr]:border-border",
        ),
      },
    },
    onUpdate: ({ editor }) => setValue(JSON.stringify(editor.getJSON())),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      <input type="hidden" name={name} value={value} />
      {editor ? <Toolbar editor={editor} /> : <div className="h-11 border-b" />}
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
      quote: editor.isActive("blockquote"),
      link: editor.isActive("link"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b bg-surface/60 p-1.5">
      <Tool label="Heading" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} icon={Heading2Icon} />
      <Tool label="Subheading" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} icon={Heading3Icon} />
      <Divider />
      <Tool label="Bold" shortcut="Ctrl+B" active={state.bold} onClick={() => chain().toggleBold().run()} icon={BoldIcon} />
      <Tool label="Italic" shortcut="Ctrl+I" active={state.italic} onClick={() => chain().toggleItalic().run()} icon={ItalicIcon} />
      <Tool label="Underline" shortcut="Ctrl+U" active={state.underline} onClick={() => chain().toggleUnderline().run()} icon={UnderlineIcon} />
      <Tool label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()} icon={StrikethroughIcon} />
      <Tool label="Inline code" active={state.code} onClick={() => chain().toggleCode().run()} icon={CodeIcon} />
      <LinkTool editor={editor} active={state.link} />
      <Divider />
      <Tool label="Bulleted list" active={state.bullet} onClick={() => chain().toggleBulletList().run()} icon={ListIcon} />
      <Tool label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()} icon={ListOrderedIcon} />
      <Tool label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()} icon={QuoteIcon} />
      <Tool label="Divider line" onClick={() => chain().setHorizontalRule().run()} icon={MinusIcon} />
      <Divider />
      <Tool label="Undo" shortcut="Ctrl+Z" disabled={!state.canUndo} onClick={() => chain().undo().run()} icon={Undo2Icon} />
      <Tool label="Redo" shortcut="Ctrl+Shift+Z" disabled={!state.canRedo} onClick={() => chain().redo().run()} icon={Redo2Icon} />
    </div>
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
