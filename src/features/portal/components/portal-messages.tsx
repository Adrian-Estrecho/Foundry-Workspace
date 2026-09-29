"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LockIcon } from "lucide-react";
import { Composer, MessageList, type ChatEntry } from "@/features/messages/components/chat";
import { sendPortalMessage } from "../actions";
import type { PortalMessage } from "../queries";

/** The client's conversation with the team. Sent messages show straight away while they save. */
export function PortalMessages({
  token,
  workspaceName,
  contactName,
  messages,
  lastReadAt,
  renderedAt,
}: {
  token: string;
  workspaceName: string;
  contactName: string;
  messages: PortalMessage[];
  lastReadAt: string | null;
  renderedAt: number;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<ChatEntry[]>([]);
  const [newSince] = React.useState(lastReadAt);

  const [synced, setSynced] = React.useState(messages);
  if (synced !== messages) {
    setSynced(messages);
    setPending((list) => list.filter((p) => !messages.some((m) => m.fromClient && m.body === p.body)));
  }

  const entries: ChatEntry[] = [
    ...messages.map((m) => ({
      id: m.id,
      body: m.body,
      authorName: m.fromClient ? "You" : m.authorName,
      authorAvatar: m.authorAvatar,
      createdAt: m.createdAt,
      own: m.fromClient,
    })),
    ...pending,
  ];

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
    const result = await sendPortalMessage(token, body);
    if (!result.ok) {
      setPending((list) => list.filter((p) => p.id !== entry.id));
      toast.error(result.error);
      return false;
    }
    router.refresh();
    return true;
  };

  return (
    <section
      aria-label={`Messages with ${workspaceName}`}
      className="flex h-[calc(100dvh-15rem)] min-h-[26rem] flex-col overflow-hidden rounded-xl border bg-card"
    >
      <header className="flex items-center gap-2 border-b px-4 py-3 text-sm">
        <LockIcon className="size-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">
          Private between you and the {workspaceName} team. We usually reply within a working day.
        </span>
      </header>
      <MessageList
        entries={entries}
        newSince={newSince}
        renderedAt={renderedAt}
        className="min-h-0 flex-1"
        emptyText={`Hi ${contactName.split(" ")[0] || "there"}! Questions, feedback on a cut, a new request: write to the team here.`}
      />
      <Composer onSend={send} placeholder={`Message ${workspaceName}…`} />
    </section>
  );
}
