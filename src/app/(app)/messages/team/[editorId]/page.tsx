import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Conversation } from "@/features/messages/components/conversation";
import { InboxList } from "@/features/messages/components/inbox-list";
import { InboxShell, MessagesFrame } from "@/features/messages/components/messages-frame";
import { getEditorConversation, getEditorInbox, getInboxCounts } from "@/features/messages/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Team messages" };

/** An admin's conversation with one editor. (Editors have theirs at /messages/team.) */
export default async function EditorThreadPage(props: PageProps<"/messages/team/[editorId]">) {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/messages/team");
  const { editorId } = await props.params;

  const counts = await getInboxCounts(user);
  const [inbox, conversation] = await Promise.all([getEditorInbox(counts.unreadThreadIds), getEditorConversation(user, editorId)]);
  const { renderedAt } = counts;

  return (
    <MessagesFrame tab="team" isAdmin counts={counts}>
      <InboxShell
        selected
        list={
          <InboxList
            items={inbox}
            basePath="/messages/team"
            kind="editor"
            renderedAt={renderedAt}
            emptyTitle="No editors yet"
            emptyText="Once editors join, each gets a private line to the admins here."
          />
        }
      >
        <Conversation
          key={editorId}
          data={conversation}
          viewer={{ id: user.id, isAdmin: true, timeZone: user.timezone }}
          backHref="/messages/team"
          renderedAt={renderedAt}
        />
      </InboxShell>
    </MessagesFrame>
  );
}
