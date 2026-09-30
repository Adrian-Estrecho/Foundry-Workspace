import { HeaderSkeleton, PageSkeleton, PanelsSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceLoading() {
  return (
    <PageSkeleton label="workspace">
      <HeaderSkeleton action />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <div className="hidden content-start gap-2 lg:grid">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 rounded-lg" />
          ))}
        </div>
        <PanelsSkeleton heights={["h-96", "h-72", "h-72"]} />
      </div>
    </PageSkeleton>
  );
}
