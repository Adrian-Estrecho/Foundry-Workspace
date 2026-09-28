import { Skeleton } from "@/components/ui/skeleton";

/** Dashboard skeleton, shaped like the real layout to avoid a jump. */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="mb-2 h-9 w-72 rounded-xl" />
      <Skeleton className="mb-6 h-5 w-96 max-w-full rounded-lg" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="grid gap-5 xl:col-span-8">
          <Skeleton className="h-96 rounded-xl" />
          <div className="grid gap-5 md:grid-cols-5">
            <Skeleton className="h-80 rounded-xl md:col-span-2" />
            <Skeleton className="h-80 rounded-xl md:col-span-3" />
          </div>
        </div>
        <Skeleton className="h-[42rem] rounded-xl xl:col-span-4" />
      </div>
    </div>
  );
}
