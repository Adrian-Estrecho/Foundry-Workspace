import { DetailHeaderSkeleton, PageSkeleton, SplitSkeleton } from "@/components/shared/page-skeleton";

export default function ClientLoading() {
  return (
    <PageSkeleton label="client">
      <DetailHeaderSkeleton />
      <SplitSkeleton />
    </PageSkeleton>
  );
}
