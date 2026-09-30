import { DetailHeaderSkeleton, PageSkeleton, SplitSkeleton, StatTilesSkeleton } from "@/components/shared/page-skeleton";

export default function EditorLoading() {
  return (
    <PageSkeleton label="editor">
      <DetailHeaderSkeleton />
      <StatTilesSkeleton />
      <SplitSkeleton />
    </PageSkeleton>
  );
}
