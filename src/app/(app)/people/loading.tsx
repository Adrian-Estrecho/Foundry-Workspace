import { HeaderSkeleton, PageSkeleton, RowsSkeleton, TabsSkeleton } from "@/components/shared/page-skeleton";

export default function PeopleLoading() {
  return (
    <PageSkeleton label="people">
      <HeaderSkeleton action />
      <TabsSkeleton className="mb-5" />
      <RowsSkeleton />
    </PageSkeleton>
  );
}
