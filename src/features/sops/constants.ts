import type { Enums } from "@/types/database";

export const SOP_CATEGORY_LABEL: Record<Enums<"sop_category">, string> = {
  editing_workflow: "Editing workflow",
  frameio_review: "Frame.io review",
  file_naming_delivery: "File naming & delivery",
  communication: "Communication",
};
