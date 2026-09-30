import { BoardSkeleton, HeaderSkeleton, PageSkeleton, TabsSkeleton } from "@/components/shared/page-skeleton";

export default function ApplicantsLoading() {
  return (
    <PageSkeleton label="applicants">
      <HeaderSkeleton />
      <TabsSkeleton />
      <BoardSkeleton columns={5} />
    </PageSkeleton>
  );
}
