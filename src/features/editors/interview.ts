import type { Enums } from "@/types/database";

export const INTERVIEW_OUTCOME: Record<Enums<"interview_outcome">, { label: string; className: string }> = {
  scheduled: { label: "Booked", className: "bg-primary/12 text-primary ring-primary/25" },
  passed: { label: "Passed", className: "bg-success/12 text-success ring-success/25" },
  failed: { label: "Did not pass", className: "bg-danger/10 text-danger ring-danger/25" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground ring-border" },
};

/** "Thu, Oct 2, 3:30 PM" in a given time zone. */
export const interviewTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
