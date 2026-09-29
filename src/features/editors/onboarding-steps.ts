import type { Enums } from "@/types/database";

export type OnboardingStep = { key: string; label: string; done: boolean };

/**
 * The steps an editor sees, in order. The checklist has one "trial_task"
 * step; it shows as two here: handing the test edit in, and passing its
 * review.
 */
export function onboardingSteps(
  checklist: { key: string; is_done: boolean }[],
  trialStatus: Enums<"task_status"> | null,
): OnboardingStep[] {
  const checked = (key: string) => checklist.find((item) => item.key === key)?.is_done ?? false;
  return [
    { key: "contract_nda", label: "Contract and NDA", done: checked("contract_nda") },
    { key: "payment_details", label: "Payment details", done: checked("payment_details") },
    { key: "frameio", label: "Frame.io", done: checked("frameio") },
    { key: "sops", label: "Required SOPs", done: checked("sops") },
    { key: "asset_pack", label: "Asset pack", done: checked("asset_pack") },
    { key: "test_edit", label: "Test edit", done: checked("trial_task") || trialStatus === "for_review" },
    { key: "trial_task", label: "Test review", done: checked("trial_task") },
    { key: "interview", label: "Interview", done: checked("interview") },
  ];
}
