import type { Metadata } from "next";
import { MessagesSquareIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { Conversation } from "@/features/messages/components/conversation";
import { InboxList } from "@/features/messages/components/inbox-list";
import { InboxShell, MessagesFrame } from "@/features/messages/components/messages-frame";
import { getEditorConversation, getEditorInbox, getInboxCounts } from "@/features/messages/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Team messages" };

/**
 * Admins: every editor's private thread. Editors: their own conversation
 * with the admins.
 */
export default async function TeamMessagesPage() {
  const user = await requireUser();
  const counts = await getInboxCounts(user);
  const isAdmin = user.role === "admin";

  if (!isAdmin) {
    const conversation = await getEditorConversation(user, user.id);
    return (
      <MessagesFrame tab="team" isAdmin={false} counts={counts}>
        <div className="flex h-[calc(100dvh-16.5rem)] min-h-[28rem] flex-col overflow-hidden rounded-xl border bg-card">
          <Conversation data={conversation} viewer={{ id: user.id, isAdmin: false, timeZone: user.timezone }} renderedAt={counts.renderedAt} />
        </div>
      </MessagesFrame>
    );
  }

  const inbox = await getEditorInbox(counts.unreadThreadIds);
  return (
    <MessagesFrame tab="team" isAdmin counts={counts}>
      <InboxShell
        selected={false}
        list={
          <InboxList
            items={inbox}
            basePath="/messages/team"
            kind="editor"
            renderedAt={counts.renderedAt}
            emptyTitle="No editors yet"
            emptyText="Once editors join, each gets a private line to the admins here."
          />
        }
      >
        <EmptyState
          icon={MessagesSquareIcon}
          title="Pick a conversation"
          description="Each editor has a private thread with the admins. Only admins and that editor can read it."
          className="h-full"
        />
      </InboxShell>
    </MessagesFrame>
  );
}
