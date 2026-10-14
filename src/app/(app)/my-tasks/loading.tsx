import { BoardSkeleton, HeaderSkeleton, PageSkeleton, TabsSkeleton } from "@/components/shared/page-skeleton";

export default function MyTasksLoading() {
  return (
    <PageSkeleton label="your tasks">
      <HeaderSkeleton />
      <TabsSkeleton />
      <BoardSkeleton />
    </PageSkeleton>
  );
}
