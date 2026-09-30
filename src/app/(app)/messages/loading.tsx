import { HeaderSkeleton, PageSkeleton, TabsSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function MessagesLoading() {
  return (
    <PageSkeleton label="messages">
      <HeaderSkeleton />
      <TabsSkeleton />
      <Skeleton className="h-[calc(100dvh-16.5rem)] min-h-[28rem] rounded-xl" />
    </PageSkeleton>
  );
}
