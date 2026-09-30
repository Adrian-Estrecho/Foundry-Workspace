import { HeaderSkeleton, PageSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClickUpLoading() {
  return (
    <PageSkeleton label="ClickUp" className="mx-auto max-w-6xl">
      <Skeleton className="mb-3 h-5 w-24 rounded-md" />
      <HeaderSkeleton />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-xl xl:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </PageSkeleton>
  );
}
