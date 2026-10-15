import { HeaderSkeleton, PageSkeleton, TabsSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientLinksLoading() {
  return (
    <PageSkeleton label="client links">
      <HeaderSkeleton />
      <TabsSkeleton className="w-48" />
      <Skeleton className="mb-5 h-9 w-full rounded-full sm:w-72" />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className={i % 2 ? "h-56 rounded-xl" : "h-72 rounded-xl"} />
        ))}
      </div>
    </PageSkeleton>
  );
}
