"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";

export type Mentionable = { id: string; name: string; avatarUrl: string | null };

/** "@al" matches "Alex Morgan"; "@mor" matches it too. */
const matches = (name: string, query: string) => {
  const q = query.toLowerCase();
  if (!q) return true;
  const lower = name.toLowerCase();
  return lower.startsWith(q) || lower.split(/\s+/).some((word) => word.startsWith(q));
};

/**
 * Textarea with @mention suggestions. Typing "@" lists the people who can
 * be mentioned; arrows pick, Enter or Tab inserts "@Full Name". Ctrl/⌘ +
 * Enter submits.
 */
export function MentionTextarea({
  value,
  onChange,
  people,
  onSubmit,
  className,
  ...props
}: Omit<React.ComponentProps<"textarea">, "value" | "onChange" | "onSubmit"> & {
  value: string;
  onChange: (value: string) => void;
  people: Mentionable[];
  onSubmit?: () => void;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const listId = React.useId();
  const [query, setQuery] = React.useState<{ start: number; text: string } | null>(null);
  const [highlight, setHighlight] = React.useState(0);

  const options = query ? people.filter((p) => matches(p.name, query.text)).slice(0, 6) : [];
  const open = options.length > 0;
  const active = Math.min(highlight, Math.max(0, options.length - 1));

  // Is the caret just after "@something"? Names have spaces, so allow single ones.
  const detect = (element: HTMLTextAreaElement) => {
    const before = element.value.slice(0, element.selectionStart);
    const at = before.lastIndexOf("@");
    const text = before.slice(at + 1);
    if (at === -1 || (at > 0 && !/\s/.test(before[at - 1])) || text.length > 30 || /\n|\s\s/.test(text)) {
      setQuery(null);
      return;
    }
    setQuery({ start: at, text });
    setHighlight(0);
  };

  // Where the caret goes once the inserted mention has rendered.
  const pendingCaret = React.useRef<number | null>(null);
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (element && pendingCaret.current !== null) {
      element.focus();
      element.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value]);

  const choose = (person: Mentionable) => {
    const element = ref.current;
    if (!element || !query) return;
    const insert = `@${person.name} `;
    pendingCaret.current = query.start + insert.length;
    onChange(value.slice(0, query.start) + insert + value.slice(element.selectionStart));
    setQuery(null);
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          detect(event.target);
        }}
        onClick={(event) => detect(event.currentTarget)}
        onKeyDown={(event) => {
          if (open) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setHighlight((active + step + options.length) % options.length);
              return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              choose(options[active]);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setQuery(null);
              return;
            }
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && onSubmit) {
            event.preventDefault();
            onSubmit();
          }
        }}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        className={cn("rounded-xl", className)}
        {...props}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="People to mention"
          className="absolute top-full left-0 z-30 mt-1 w-64 overflow-hidden rounded-xl border bg-popover p-1 shadow-lg"
        >
          {options.map((person, index) => (
            <li
              key={person.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(person);
              }}
              onMouseEnter={() => setHighlight(index)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm", index === active && "bg-accent")}
            >
              <UserAvatar name={person.name} src={person.avatarUrl} className="size-6" />
              <span className="truncate">{person.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/** Comment text with @mentions highlighted and links clickable. */
export function MentionText({ text, names }: { text: string; names: string[] }) {
  const known = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
  const mention = known.length ? new RegExp(`(@(?:${known.map(escapeRegExp).join("|")}))`, "g") : null;
  const parts = mention ? text.split(mention) : [text];

  return (
    <>
      {parts.map((part, i) =>
        mention && i % 2 === 1 ? (
          <span key={i} className="font-medium text-primary">
            {part}
          </span>
        ) : (
          part.split(URL_PATTERN).map((piece, j) =>
            j % 2 === 1 ? (
              <a key={`${i}-${j}`} href={piece} target="_blank" rel="noreferrer" className="break-all text-primary underline-offset-2 hover:underline">
                {piece}
              </a>
            ) : (
              <React.Fragment key={`${i}-${j}`}>{piece}</React.Fragment>
            ),
          )
        ),
      )}
    </>
  );
}
