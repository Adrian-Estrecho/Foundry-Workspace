import { HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/shared/page-skeleton";

export default function MyTasksLoading() {
  return (
    <PageSkeleton label="your tasks">
      <HeaderSkeleton action />
      <RowsSkeleton />
    </PageSkeleton>
  );
}
