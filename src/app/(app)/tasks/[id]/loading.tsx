import { DetailHeaderSkeleton, PageSkeleton, PanelsSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function TaskLoading() {
  return (
    <PageSkeleton label="task" className="mx-auto max-w-5xl">
      <DetailHeaderSkeleton />
      {/* The task's fields, two columns as on the page. */}
      <div className="mb-5 grid grid-cols-1 gap-x-10 gap-y-3 border-b pb-5 md:grid-cols-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-28 shrink-0 rounded-md" />
            <Skeleton className="h-6 w-36 rounded-md" />
          </div>
        ))}
      </div>
      <PanelsSkeleton heights={["h-36", "h-48", "h-56"]} />
    </PageSkeleton>
  );
}
