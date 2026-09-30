import { HeaderSkeleton, PageSkeleton, TabsSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <PageSkeleton label="projects">
      <HeaderSkeleton />
      <TabsSkeleton className="mb-5" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </PageSkeleton>
  );
}
