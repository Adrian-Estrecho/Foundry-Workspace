import { BoardSkeleton, HeaderSkeleton, PageSkeleton, TabsSkeleton } from "@/components/shared/page-skeleton";

export default function ClientsLoading() {
  return (
    <PageSkeleton label="clients">
      <HeaderSkeleton />
      <TabsSkeleton className="w-48" />
      <BoardSkeleton columns={5} />
    </PageSkeleton>
  );
}
