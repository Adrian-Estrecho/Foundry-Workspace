import { HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/shared/page-skeleton";

export default function SopsLoading() {
  return (
    <PageSkeleton label="SOPs" className="mx-auto max-w-3xl">
      <HeaderSkeleton action />
      <RowsSkeleton rows={5} />
    </PageSkeleton>
  );
}
