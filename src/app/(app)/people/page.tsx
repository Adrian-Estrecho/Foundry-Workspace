import type { Metadata } from "next";
import Link from "next/link";
import { UserPlusIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { Button } from "@/components/ui/button";
import { PeopleTable } from "@/features/people/components/people-table";
import { getPeople } from "@/features/people/queries";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "People" };

/**
 * Everyone in the workspace and what they can do. Owners and admins give
 * editors single admin abilities and access titles from here.
 */
export default async function PeoplePage() {
  const user = await requireAdmin();
  const people = await getPeople(user);
  const admins = people.filter((p) => p.role !== "editor").length;
  const extra = people.filter((p) => p.role === "editor" && p.permissions.length > 0).length;

  return (
    <>
      <RealtimeRefresh channel="people" tables="workspace_members" />
      <PageHeader
        title="People"
        description={`${people.length} in ${user.workspace.name} · ${admins} with full access · ${extra} ${extra === 1 ? "editor" : "editors"} with extra abilities`}
        actions={
          <Button asChild variant="secondary" className="bg-surface ring-1 ring-border">
            <Link href="/editors">
              <UserPlusIcon /> Invite from Editors
            </Link>
          </Button>
        }
      />
      <PeopleTable people={people} viewerId={user.id} />
    </>
  );
}
