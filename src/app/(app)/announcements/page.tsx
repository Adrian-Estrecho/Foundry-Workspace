import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Announcements" };

export default async function Page() {
  await requireUser();
  return (
    <ComingSoon
      title="Announcements"
      description="Updates, meetings and ideas."
      phase={6}
      features={[
        "Admin announcements with reactions and comments",
        "Pinned posts and unread badges",
        "Meetings with agenda, link and RSVPs",
        "Ideas board: turn any idea into a task"
      ]}
    />
  );
}
