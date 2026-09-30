import { HeaderSkeleton, PageSkeleton, PanelsSkeleton } from "@/components/shared/page-skeleton";

export default function SettingsLoading() {
  return (
    <PageSkeleton label="settings" className="mx-auto max-w-5xl">
      <HeaderSkeleton />
      <PanelsSkeleton heights={["h-96", "h-80", "h-56"]} />
    </PageSkeleton>
  );
}
