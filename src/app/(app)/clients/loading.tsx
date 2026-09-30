import { BoardSkeleton, HeaderSkeleton, PageSkeleton } from "@/components/shared/page-skeleton";

export default function ClientsLoading() {
  return (
    <PageSkeleton label="clients">
      <HeaderSkeleton />
      <BoardSkeleton columns={5} />
    </PageSkeleton>
  );
}
