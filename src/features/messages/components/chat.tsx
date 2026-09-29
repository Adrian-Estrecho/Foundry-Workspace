"use client";

import * as React from "react";
import { Loader2Icon, MessageSquareIcon, SendIcon } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ChatEntry = {
  id: string;
  body: string;
  authorName: string;
  authorAvatar: string | null;
  createdAt: string;
  /** Right-hand side: written by the viewer's side of the conversation. */
  own: boolean;
  /** Still sending. */
  pending?: boolean;
};

const noopSubscribe = () => () => {};

/**
 * The browser's time zone once hydrated; `fallback` (the viewer's profile
 * zone, or UTC) before, so the server and first client render agree.
 */
function useTimeZone(fallback: string) {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || fallback,
    () => fallback,
  );
}

const dayKey = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

function dayLabel(iso: string, timeZone: string, now: number) {
  const key = dayKey(iso, timeZone);
  if (key === dayKey(new Date(now).toISOString(), timeZone)) return "Today";
  if (key === dayKey(new Date(now - 86_400_000).toISOString(), timeZone)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "short", day: "numeric" }).format(new Date(iso));
}

const clockTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** Splits text into plain runs and http(s) links, rendered as React (no HTML injection). */
export function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noreferrer noopener" className="break-all underline underline-offset-2 hover:opacity-80">
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

/**
 * Messages as bubbles, grouped by day. Consecutive messages from the same
 * person share one name line. `newSince` draws a "New" divider before the
 * first message from the other side after that moment.
 */
export function MessageList({
  entries,
  newSince,
  timeZone: fallbackZone = "UTC",
  renderedAt,
  emptyText = "No messages yet. Say hello.",
  className,
}: {
  entries: ChatEntry[];
  newSince?: string | null;
  timeZone?: string;
  renderedAt: number;
  emptyText?: string;
  className?: string;
}) {
  const timeZone = useTimeZone(fallbackZone);
  const bottom = React.useRef<HTMLDivElement>(null);
  const lastId = entries.at(-1)?.id;

  React.useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  if (entries.length === 0) {
    return (
      <div className={cn("grid place-items-center p-8 text-center", className)}>
        <div className="grid place-items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-muted">
            <MessageSquareIcon className="size-5 text-muted-foreground" />
          </span>
          <p className="max-w-xs text-sm text-muted-foreground">{emptyText}</p>
        </div>
      </div>
    );
  }

  const newIndex = newSince ? entries.findIndex((e) => !e.own && !e.pending && e.createdAt > newSince) : -1;

  return (
    <div className={cn("overflow-y-auto px-3 py-4 sm:px-5", className)} role="log" aria-live="polite">
      <ol className="grid gap-1">
        {entries.map((entry, index) => {
          const previous = entries[index - 1];
          const newDay = !previous || dayKey(previous.createdAt, timeZone) !== dayKey(entry.createdAt, timeZone);
          const grouped =
            !newDay &&
            previous &&
            previous.own === entry.own &&
            previous.authorName === entry.authorName &&
            Date.parse(entry.createdAt) - Date.parse(previous.createdAt) < 5 * 60_000;
          return (
            <React.Fragment key={entry.id}>
              {newDay && (
                <li className="my-3 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden={false}>
                  <span className="h-px flex-1 bg-border" />
                  {dayLabel(entry.createdAt, timeZone, renderedAt)}
                  <span className="h-px flex-1 bg-border" />
                </li>
              )}
              {index === newIndex && (
                <li className="my-2 flex items-center gap-3 text-xs font-medium text-primary">
                  <span className="h-px flex-1 bg-primary/40" />
                  New
                  <span className="h-px flex-1 bg-primary/40" />
                </li>
              )}
              <li className={cn("flex items-end gap-2", entry.own ? "justify-end" : "justify-start", !grouped && "mt-2")}>
                {!entry.own && (
                  <span className="w-7 shrink-0">
                    {!grouped && <UserAvatar name={entry.authorName} src={entry.authorAvatar} className="size-7" />}
                  </span>
                )}
                <div className={cn("flex max-w-[min(34rem,85%)] flex-col", entry.own ? "items-end" : "items-start")}>
                  {!grouped && (
                    <span className="mb-1 px-1 text-xs text-muted-foreground">
                      {entry.authorName} · {clockTime(entry.createdAt, timeZone)}
                    </span>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
                      entry.own ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-surface ring-1 ring-border",
                      entry.pending && "opacity-60",
                    )}
                    title={clockTime(entry.createdAt, timeZone)}
                  >
                    <Linkified text={entry.body} />
                  </div>
                  {entry.pending && <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">Sending…</span>}
                </div>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
      <div ref={bottom} />
    </div>
  );
}

/**
 * Message box. Enter sends, Shift+Enter adds a line. Keeps the text if
 * sending fails.
 */
export function Composer({
  onSend,
  disabled,
  placeholder = "Write a message…",
  autoFocus,
}: {
  onSend: (body: string) => Promise<boolean>;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const send = async () => {
    const text = body.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    setBody("");
    const ok = await onSend(text);
    setSending(false);
    if (!ok) setBody(text);
    ref.current?.focus();
  };

  return (
    <form
      className="flex items-end gap-2 border-t p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <Textarea
        ref={ref}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void send();
          }
        }}
        placeholder={placeholder}
        aria-label="Message"
        rows={1}
        maxLength={4000}
        disabled={disabled}
        autoFocus={autoFocus}
        className="max-h-40 min-h-10 resize-none"
      />
      <Button type="submit" size="icon" disabled={disabled || sending || !body.trim()} aria-label="Send">
        {sending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
      </Button>
    </form>
  );
}
