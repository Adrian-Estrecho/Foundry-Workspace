import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { ApplicantPipeline } from "@/features/applicants/components/applicant-pipeline";
import { getApplicantPipeline } from "@/features/applicants/queries";
import { EditorsTabs } from "@/features/editors/components/editors-tabs";
import { requireAdmin } from "@/lib/auth";
import { todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Applicants" };

export default async function ApplicantsPage() {
  const user = await requireAdmin();
  const { applicants, lastTestEditUrl } = await getApplicantPipeline();
  const count = (stage: string) => applicants.filter((a) => a.column === stage).length;
  const inProgress = applicants.filter((a) => a.column !== "approved" && a.column !== "rejected").length;

  return (
    <>
      <RealtimeRefresh channel="applicants" tables="applicants" />
      <PageHeader
        title="Editors"
        description={`${inProgress} in progress · ${count("applied")} new · ${count("test_submitted")} tests to review`}
      />
      <EditorsTabs current="applicants" newApplicants={count("applied")} />
      <ApplicantPipeline applicants={applicants} lastTestEditUrl={lastTestEditUrl} today={todayIn(user.timezone)} />
    </>
  );
}
