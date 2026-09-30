import { HeaderSkeleton, PageSkeleton, PanelsSkeleton } from "@/components/shared/page-skeleton";

export default function OnboardingLoading() {
  return (
    <PageSkeleton label="onboarding" className="mx-auto max-w-3xl">
      <HeaderSkeleton />
      <PanelsSkeleton heights={["h-64", "h-48", "h-48"]} />
    </PageSkeleton>
  );
}
