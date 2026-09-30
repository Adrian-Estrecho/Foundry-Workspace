import { DetailHeaderSkeleton, PageSkeleton, SplitSkeleton } from "@/components/shared/page-skeleton";

export default function TaskLoading() {
  return (
    <PageSkeleton label="task">
      <DetailHeaderSkeleton />
      <SplitSkeleton />
    </PageSkeleton>
  );
}
