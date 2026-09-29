import type { Metadata } from "next";
import { Building2Icon } from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { InboxList } from "@/features/messages/components/inbox-list";
import { InboxShell, MessagesFrame } from "@/features/messages/components/messages-frame";
import { getClientInbox, getInboxCounts } from "@/features/messages/queries";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Client messages" };

/** Conversations with clients, who write in from their project portal. */
export default async function ClientMessagesPage() {
  const user = await requireAdmin();
  const counts = await getInboxCounts(user);
  const inbox = await getClientInbox(counts.unreadThreadIds);

  return (
    <MessagesFrame tab="clients" isAdmin counts={counts}>
      <InboxShell
        selected={false}
        list={
          <InboxList
            items={inbox}
            basePath="/messages/clients"
            kind="client"
            renderedAt={counts.renderedAt}
            emptyTitle="No client conversations yet"
            emptyText="Create a client portal from a client's page. They follow their tasks there and message you here."
          />
        }
      >
        <EmptyState
          icon={Building2Icon}
          title="Pick a client"
          description="Clients write from their private project portal. Your replies show there, and we email them a link."
          className="h-full"
        />
      </InboxShell>
    </MessagesFrame>
  );
}
