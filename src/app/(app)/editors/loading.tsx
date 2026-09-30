import { HeaderSkeleton, PageSkeleton, RowsSkeleton, TabsSkeleton } from "@/components/shared/page-skeleton";

export default function EditorsLoading() {
  return (
    <PageSkeleton label="editors">
      <HeaderSkeleton />
      <TabsSkeleton />
      <TabsSkeleton className="mb-5" />
      <RowsSkeleton />
    </PageSkeleton>
  );
}
