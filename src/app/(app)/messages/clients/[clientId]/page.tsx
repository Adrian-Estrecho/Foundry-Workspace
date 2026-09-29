import type { Metadata } from "next";
import { Conversation } from "@/features/messages/components/conversation";
import { InboxList } from "@/features/messages/components/inbox-list";
import { InboxShell, MessagesFrame } from "@/features/messages/components/messages-frame";
import { getClientConversation, getClientInbox, getInboxCounts } from "@/features/messages/queries";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Client messages" };

export default async function ClientThreadPage(props: PageProps<"/messages/clients/[clientId]">) {
  const user = await requireAdmin();
  const { clientId } = await props.params;

  const counts = await getInboxCounts(user);
  const [inbox, conversation] = await Promise.all([getClientInbox(counts.unreadThreadIds), getClientConversation(user, clientId)]);
  const { renderedAt } = counts;

  // A client with no portal or messages yet still opens (from the client page).
  const items = inbox.some((item) => item.id === clientId)
    ? inbox
    : [
        {
          id: clientId,
          name: conversation.title,
          avatarUrl: null,
          subtitle: "No portal",
          preview: null,
          lastSender: null,
          lastMessageAt: null,
          unread: false,
        },
        ...inbox,
      ];

  return (
    <MessagesFrame tab="clients" isAdmin counts={counts}>
      <InboxShell
        selected
        list={
          <InboxList
            items={items}
            basePath="/messages/clients"
            kind="client"
            renderedAt={renderedAt}
            emptyTitle="No client conversations yet"
            emptyText="Create a client portal from a client's page."
          />
        }
      >
        <Conversation
          key={clientId}
          data={conversation}
          viewer={{ id: user.id, isAdmin: true, timeZone: user.timezone }}
          backHref="/messages/clients"
          renderedAt={renderedAt}
        />
      </InboxShell>
    </MessagesFrame>
  );
}
