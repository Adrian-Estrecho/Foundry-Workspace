import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "SOPs" };

export default async function Page() {
  await requireUser();
  return (
    <ComingSoon
      title="SOPs"
      description="How we work at Foundry Media."
      phase={6}
      features={[
        "Rich-text SOP pages by category",
        "Mark SOPs as required for onboarding",
        "Track which editors have acknowledged each SOP"
      ]}
    />
  );
}
