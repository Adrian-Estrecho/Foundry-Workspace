import { DetailHeaderSkeleton, PageSkeleton, SplitSkeleton } from "@/components/shared/page-skeleton";

export default function ApplicantLoading() {
  return (
    <PageSkeleton label="applicant">
      <DetailHeaderSkeleton />
      <SplitSkeleton />
    </PageSkeleton>
  );
}
