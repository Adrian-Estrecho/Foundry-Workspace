import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Attendance" };

export default async function Page() {
  await requireUser();
  return (
    <ComingSoon
      title="Attendance"
      description="Who is working, and the hours behind it."
      phase={5}
      features={[
        "Start and stop working from the top bar, with the task you are on",
        "Switch tasks or take a break without stopping work",
        "End-of-shift report: what was done, blockers, progress",
        "Live status board, daily attendance log and weekly timesheets",
        "Hours per task and per project, CSV export",
        "Alerts for missed starts and offline editors with overdue work"
      ]}
    />
  );
}
