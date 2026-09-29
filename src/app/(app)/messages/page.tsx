import type { Metadata } from "next";
import { AnnouncementFeed } from "@/features/messages/components/announcement-feed";
import { MessagesFrame } from "@/features/messages/components/messages-frame";
import { getAnnouncements, getInboxCounts } from "@/features/messages/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Messages" };

/** Announcements: admins post, everyone reads, reacts and comments. */
export default async function MessagesPage() {
  const user = await requireUser();
  const [counts, { announcements, seenAt, renderedAt }] = await Promise.all([getInboxCounts(user), getAnnouncements(user)]);
  const isAdmin = user.role === "admin";

  return (
    <MessagesFrame tab="announcements" isAdmin={isAdmin} counts={counts}>
      <AnnouncementFeed announcements={announcements} seenAt={seenAt} renderedAt={renderedAt} viewer={{ id: user.id, isAdmin }} />
    </MessagesFrame>
  );
}
