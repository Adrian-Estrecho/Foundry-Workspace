import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { ApplicantPipeline } from "@/features/applicants/components/applicant-pipeline";
import { getApplicantPipeline } from "@/features/applicants/queries";
import { EditorsTabs } from "@/features/editors/components/editors-tabs";
import { requirePermission } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Applicants" };

export default async function ApplicantsPage() {
  const user = await requirePermission("editors.manage");
  const { applicants } = await getApplicantPipeline();
  const count = (stage: string) => applicants.filter((a) => a.column === stage).length;
  const inProgress = applicants.filter((a) => a.column !== "joined" && a.column !== "rejected").length;

  return (
    <>
      <RealtimeRefresh channel="applicants" tables="applicants" />
      <PageHeader
        title="Editors"
        description={`${inProgress} in progress · ${count("applied")} new · ${count("invited")} invited`}
      />
      <EditorsTabs current="applicants" newApplicants={count("applied")} />
      <ApplicantPipeline
        applicants={applicants}
        applyUrl={`${env.siteUrl}/apply/${user.workspace.slug}`}
        today={todayIn(user.timezone)}
      />
    </>
  );
}
