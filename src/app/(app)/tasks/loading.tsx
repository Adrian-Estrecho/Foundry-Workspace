import { BoardSkeleton, HeaderSkeleton, PageSkeleton, TabsSkeleton } from "@/components/shared/page-skeleton";

export default function TasksLoading() {
  return (
    <PageSkeleton label="tasks">
      <HeaderSkeleton action />
      <TabsSkeleton />
      <BoardSkeleton />
    </PageSkeleton>
  );
}
