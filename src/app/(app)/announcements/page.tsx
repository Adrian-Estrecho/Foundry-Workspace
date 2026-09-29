import { redirect } from "next/navigation";

/** Announcements live on the Messages page now. */
export default function AnnouncementsPage() {
  redirect("/messages");
}
