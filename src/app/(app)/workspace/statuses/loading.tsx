import { HeaderSkeleton, PageSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatusesLoading() {
  return (
    <PageSkeleton label="statuses" className="mx-auto max-w-6xl">
      <Skeleton className="mb-3 h-5 w-24 rounded-md" />
      <HeaderSkeleton />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </PageSkeleton>
  );
}
