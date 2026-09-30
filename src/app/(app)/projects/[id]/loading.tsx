import { DetailHeaderSkeleton, PageSkeleton, StatTilesSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLoading() {
  return (
    <PageSkeleton label="project">
      <DetailHeaderSkeleton />
      <StatTilesSkeleton />
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </PageSkeleton>
  );
}
