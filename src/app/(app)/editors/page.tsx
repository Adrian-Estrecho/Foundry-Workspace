import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { EditorRoster } from "@/features/editors/components/editor-roster";
import { EditorsTabs } from "@/features/editors/components/editors-tabs";
import { getRoster } from "@/features/editors/queries";
import { getOpenInvitations } from "@/features/invitations/queries";
import { requirePermission } from "@/lib/auth";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Editors" };

export default async function EditorsPage() {
  const user = await requirePermission("editors.manage");
  const [{ editors, newApplicants, renderedAt }, invitations] = await Promise.all([getRoster(user), getOpenInvitations()]);
  const active = editors.filter((e) => e.memberStatus === "active" && e.isActive);
  const onboarding = editors.filter((e) => e.memberStatus === "onboarding").length;

  return (
    <>
      <RealtimeRefresh channel="editors" tables="editors,editor_checklist_items,workspace_members,workspace_invitations" />
      <PageHeader
        title="Editors"
        description={`${active.length} active · ${onboarding} onboarding · ${newApplicants} new ${newApplicants === 1 ? "applicant" : "applicants"}`}
      />
      <EditorsTabs current="roster" newApplicants={newApplicants} />
      <EditorRoster
        editors={editors}
        invitations={invitations}
        applyUrl={`${env.siteUrl}/apply/${user.workspace.slug}`}
        renderedAt={renderedAt}
      />
    </>
  );
}
