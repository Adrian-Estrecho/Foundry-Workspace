import { HeaderSkeleton, PageSkeleton, StatTilesSkeleton, TabsSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AttendanceLoading() {
  return (
    <PageSkeleton label="attendance">
      <HeaderSkeleton action />
      <TabsSkeleton />
      <StatTilesSkeleton />
      <Skeleton className="h-96 rounded-xl" />
    </PageSkeleton>
  );
}
