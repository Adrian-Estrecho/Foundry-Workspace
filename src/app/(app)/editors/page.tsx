import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { EditorRoster } from "@/features/editors/components/editor-roster";
import { EditorsTabs } from "@/features/editors/components/editors-tabs";
import { getRoster } from "@/features/editors/queries";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Editors" };

export default async function EditorsPage() {
  const user = await requireAdmin();
  const { editors, newApplicants, renderedAt } = await getRoster(user);
  const active = editors.filter((e) => e.isActive);
  const onboarding = active.filter((e) => e.onboarding).length;

  return (
    <>
      <RealtimeRefresh channel="editors" tables="editors,editor_checklist_items" />
      <PageHeader
        title="Editors"
        description={`${active.length} active · ${onboarding} onboarding · ${newApplicants} new ${newApplicants === 1 ? "applicant" : "applicants"}`}
      />
      <EditorsTabs current="roster" newApplicants={newApplicants} />
      <EditorRoster
        editors={editors}
        renderedAt={renderedAt}
        timeZones={Intl.supportedValuesOf("timeZone")}
        defaultTimeZone={user.timezone}
      />
    </>
  );
}
