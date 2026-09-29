"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, Building2Icon, ExternalLinkIcon, LockIcon } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { subscribeAsUser } from "@/lib/supabase/realtime";
import { markThreadRead, sendMessage } from "../actions";
import type { Conversation as ConversationData } from "../queries";
import { Composer, MessageList, type ChatEntry } from "./chat";

/**
 * One private conversation. New messages arrive over Realtime; opening it
 * (or receiving a message while it's open) marks it read. Sent messages
 * show straight away while they save.
 */
export function Conversation({
  data,
  viewer,
  backHref,
  renderedAt,
}: {
  data: ConversationData;
  viewer: { id: string; isAdmin: boolean; timeZone: string };
  backHref?: string;
  renderedAt: number;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<ChatEntry[]>([]);
  // The "New" divider stays where it was when the conversation opened.
  const [newSince] = React.useState(data.lastReadAt);

  // Fresh messages from the server replace the ones still showing as sending.
  const [synced, setSynced] = React.useState(data.messages);
  if (synced !== data.messages) {
    setSynced(data.messages);
    setPending((list) => list.filter((p) => !data.messages.some((m) => m.authorId === viewer.id && m.body === p.body)));
  }

  const threadId = data.threadId;
  const lastMessageAt = data.messages.at(-1)?.createdAt;

  // Read when opened, and whenever something new arrives while it's open.
  React.useEffect(() => {
    if (!threadId || document.visibilityState !== "visible") return;
    void markThreadRead(threadId);
  }, [threadId, lastMessageAt]);

  React.useEffect(() => {
    if (!threadId) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeAsUser(`thread:${threadId}`, (channel) =>
      channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => router.refresh(), 250);
      }),
    );
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [threadId, router]);

  const isOwn = (sender: string, authorId: string | null) =>
    viewer.isAdmin ? sender === "admin" : authorId === viewer.id;

  const entries: ChatEntry[] = [
    ...data.messages.map((m) => ({
      id: m.id,
      body: m.body,
      authorName: m.authorId === viewer.id ? "You" : m.authorName,
      authorAvatar: m.authorAvatar,
      createdAt: m.createdAt,
      own: isOwn(m.sender, m.authorId),
    })),
    ...pending,
  ];

  const clientBlocked = data.kind === "client" && !data.portal?.enabled;

  const send = async (body: string) => {
    const entry: ChatEntry = {
      id: `pending-${Date.now()}`,
      body,
      authorName: "You",
      authorAvatar: null,
      createdAt: new Date().toISOString(),
      own: true,
      pending: true,
    };
    setPending((list) => [...list, entry]);
    const result = await sendMessage({ kind: data.kind, subjectId: data.subjectId, body });
    if (!result.ok) {
      setPending((list) => list.filter((p) => p.id !== entry.id));
      toast.error(result.error);
      return false;
    }
    router.refresh();
    return true;
  };

  const seenByClient =
    data.kind === "client" && data.clientLastReadAt && data.messages.length > 0
      ? data.messages.filter((m) => m.sender === "admin").at(-1)?.createdAt
      : null;

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`Conversation with ${data.title}`}>
      <header className="flex items-center gap-3 border-b px-3 py-3 sm:px-4">
        {backHref && (
          <Button asChild variant="ghost" size="icon-sm" className="lg:hidden">
            <Link href={backHref} aria-label="All conversations">
              <ArrowLeftIcon />
            </Link>
          </Button>
        )}
        {data.kind === "client" ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
            <Building2Icon className="size-4" />
          </span>
        ) : (
          <UserAvatar name={data.title} src={data.avatarUrl} className="size-9" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{data.title}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {data.kind === "editor" && <LockIcon className="size-3 shrink-0" />}
            {data.kind === "client"
              ? [data.subtitle, data.clientEmail].filter(Boolean).join(" · ") || "Client"
              : data.subtitle}
          </p>
        </div>
        {data.kind === "client" && (
          <div className="flex shrink-0 items-center gap-1">
            {data.portal?.enabled && (
              <Button asChild variant="ghost" size="sm">
                <a href={`/portal/${data.portal.token}?view=messages`} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon /> <span className="hidden sm:inline">Their portal</span>
                </a>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/clients/${data.subjectId}`}>Client</Link>
            </Button>
          </div>
        )}
        {data.kind === "editor" && viewer.isAdmin && (
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href={`/editors/${data.subjectId}`}>Profile</Link>
          </Button>
        )}
      </header>

      <MessageList
        entries={entries}
        newSince={newSince}
        timeZone={viewer.timeZone}
        renderedAt={renderedAt}
        className="min-h-0 flex-1"
        emptyText={
          data.kind === "client"
            ? "No messages yet. What you write here shows in their portal, and we email them a link."
            : viewer.isAdmin
              ? "No messages yet. Only this editor and your admins see this conversation."
              : "Questions, time off, anything private: only you and the admins see this."
        }
      />

      {seenByClient && data.clientLastReadAt && data.clientLastReadAt >= seenByClient && (
        <p className="px-4 pb-1 text-right text-[11px] text-muted-foreground">Seen in their portal</p>
      )}

      {clientBlocked ? (
        <div className="border-t p-4 text-sm text-muted-foreground">
          {data.portal ? "Their portal is turned off, so they can't read replies." : "They don't have a portal yet, so they can't read replies."}{" "}
          <Link href={`/clients/${data.subjectId}`} className="font-medium text-foreground underline underline-offset-2">
            {data.portal ? "Turn it on" : "Create one"}
          </Link>{" "}
          on the client page.
        </div>
      ) : (
        <Composer onSend={send} placeholder={data.kind === "client" ? "Reply to the client…" : "Write a message…"} />
      )}
    </section>
  );
}
