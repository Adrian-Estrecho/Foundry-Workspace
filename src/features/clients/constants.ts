import type { Enums } from "@/types/database";

export type ClientStage = Enums<"client_stage">;

/** Pipeline columns, in order. `dot` colours the column marker. */
export const CLIENT_STAGES: { value: ClientStage; label: string; dot: string }[] = [
  { value: "new_lead", label: "New Lead", dot: "bg-status-online" },
  { value: "discovery_call", label: "Discovery Call", dot: "bg-warning" },
  { value: "contract_sent", label: "Contract Sent", dot: "bg-warning" },
  { value: "contract_signed", label: "Contract Signed", dot: "bg-primary" },
  { value: "deposit_paid", label: "Deposit Paid", dot: "bg-primary" },
  { value: "kickoff", label: "Kickoff", dot: "bg-success" },
  { value: "active_client", label: "Active Client", dot: "bg-success" },
  { value: "completed", label: "Completed", dot: "bg-muted-foreground" },
];

export const stageLabel = (stage: ClientStage) => CLIENT_STAGES.find((s) => s.value === stage)?.label ?? stage;
export const stageIndex = (stage: ClientStage) => CLIENT_STAGES.findIndex((s) => s.value === stage);

/** The checklist appears from this stage on (created by the database). */
export const CHECKLIST_FROM_STAGE: ClientStage = "contract_signed";

/** Items the database ticks by itself, with the reason shown in the UI. */
export const AUTO_CHECKLIST_HINTS: Record<string, string> = {
  contract_uploaded: "Ticks itself when a contract PDF is uploaded",
  deposit_received: "Ticks itself when the deposit is marked paid",
  drive_folder: "Ticks itself when a Drive folder link is added",
  editor_assigned: "Ticks itself when an editor joins one of the client's projects",
};

export const PROJECT_TYPES = [
  "Short-form social",
  "YouTube long-form",
  "Ads & commercials",
  "Brand film",
  "Podcast",
  "Event recap",
  "Other",
];

export const BUDGET_RANGES = ["Under $1k", "$1k–2k", "$2k–5k", "$5k–10k", "$10k+"];
