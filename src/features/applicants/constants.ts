import type { Enums } from "@/types/database";

export type ApplicantStage = Enums<"applicant_stage">;

/** Pipeline columns, in order. `dot` colours the column marker. */
export const APPLICANT_STAGES: { value: ApplicantStage; label: string; dot: string }[] = [
  { value: "applied", label: "Applied", dot: "bg-status-online" },
  { value: "shortlisted", label: "Shortlisted", dot: "bg-warning" },
  { value: "invited", label: "Invited", dot: "bg-primary" },
  { value: "joined", label: "Joined", dot: "bg-success" },
  { value: "rejected", label: "Rejected", dot: "bg-muted-foreground" },
];

export const applicantStageLabel = (stage: ApplicantStage) =>
  APPLICANT_STAGES.find((s) => s.value === stage)?.label ?? stage;

/** Stages reached through a decision that can email the applicant (invite, reject). */
export const DECISION_STAGES = ["invited", "rejected"] as const satisfies ApplicantStage[];
export type DecisionStage = (typeof DECISION_STAGES)[number];
export const isDecisionStage = (stage: ApplicantStage): stage is DecisionStage =>
  (DECISION_STAGES as readonly ApplicantStage[]).includes(stage);

/** Only reached by accepting an invitation. */
export const JOINED_MESSAGE = "Applicants move to Joined themselves, when they accept their invitation.";

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
