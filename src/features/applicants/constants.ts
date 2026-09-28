import type { Enums } from "@/types/database";

export type ApplicantStage = Enums<"applicant_stage">;

/** Pipeline columns, in order. `dot` colours the column marker. */
export const APPLICANT_STAGES: { value: ApplicantStage; label: string; dot: string }[] = [
  { value: "applied", label: "Applied", dot: "bg-status-online" },
  { value: "test_edit_sent", label: "Test Edit Sent", dot: "bg-warning" },
  { value: "test_submitted", label: "Test Submitted", dot: "bg-primary" },
  { value: "interview", label: "Interview", dot: "bg-primary" },
  { value: "approved", label: "Approved", dot: "bg-success" },
  { value: "rejected", label: "Rejected", dot: "bg-muted-foreground" },
];

export const applicantStageLabel = (stage: ApplicantStage) =>
  APPLICANT_STAGES.find((s) => s.value === stage)?.label ?? stage;

/** Stages that need a confirmation (and may email the applicant). */
export const DECISION_STAGES: ApplicantStage[] = ["approved", "rejected"];

export const SOFTWARE_OPTIONS = [
  "Premiere Pro",
  "After Effects",
  "DaVinci Resolve",
  "Final Cut Pro",
  "CapCut",
  "Avid Media Composer",
  "Photoshop",
  "Blender",
] as const;

export const SPECIALTY_OPTIONS = [
  "Short-form",
  "Long-form YouTube",
  "Paid social ads",
  "Motion graphics",
  "Color grading",
  "Sound design",
  "Documentary",
  "Podcasts",
] as const;
