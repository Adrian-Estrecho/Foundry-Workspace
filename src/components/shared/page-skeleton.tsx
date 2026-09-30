import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/*
 * Stand-ins for the loading.tsx files. Pages load their data on the server, so
 * without these a click shows nothing until the whole next page arrives. With
 * them the page's shape appears at once (Next prefetches it) and fills in.
 */

const times = (n: number) => Array.from({ length: n }, (_, i) => i);

/** The wrapper every loading page uses, so screen readers hear it's busy. */
export function PageSkeleton({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-label={`Loading ${label}`} className={className}>
      {children}
    </div>
  );
}

/** Shaped like PageHeader: a title, a line of description and maybe a button. */
export function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full rounded-md" />
      </div>
      {action && <Skeleton className="h-9 w-32 shrink-0 rounded-lg" />}
    </div>
  );
}

/** A detail page's back link and title. */
export function DetailHeaderSkeleton() {
  return (
    <div className="mb-6">
      <Skeleton className="h-5 w-24 rounded-md" />
      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="mt-2 h-9 w-80 max-w-full rounded-lg" />
        </div>
        <Skeleton className="h-10 w-36 shrink-0 rounded-lg" />
      </div>
    </div>
  );
}

/** Page tabs or a segmented control. */
export function TabsSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("mb-4 h-9 w-80 max-w-full rounded-lg", className)} />;
}

/** Kanban columns, as on the client and applicant pipelines and the task board. */
export function BoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-start gap-4 overflow-hidden pb-6">
      {times(columns).map((i) => (
        <div key={i} className="grid w-[82vw] max-w-80 shrink-0 gap-3 sm:w-72">
          <Skeleton className="h-6 w-28 rounded-md" />
          {times(3 - (i % 2)).map((j) => (
            <Skeleton key={j} className="h-28 rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A card of list rows, each with an avatar or icon, two lines and a chip. */
export function RowsSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-2", className)}>
      {times(rows).map((i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="grid min-w-0 flex-1 gap-2">
            <Skeleton className="h-4 w-2/5 rounded-md" />
            <Skeleton className="h-3 w-1/4 rounded-md" />
          </div>
          <Skeleton className="hidden h-6 w-20 shrink-0 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

/** The row of four number tiles on detail pages and reports. */
export function StatTilesSkeleton() {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {times(4).map((i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

/** A detail page's main column and side column. */
export function SplitSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <div className="grid grid-cols-1 content-start gap-5 xl:col-span-8">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 content-start gap-5 xl:col-span-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

/** Stacked form panels, as on Settings and Workspace. */
export function PanelsSkeleton({ heights }: { heights: string[] }) {
  return (
    <div className="grid grid-cols-1 content-start gap-5">
      {heights.map((height, i) => (
        <Skeleton key={i} className={cn("rounded-xl", height)} />
      ))}
    </div>
  );
}
