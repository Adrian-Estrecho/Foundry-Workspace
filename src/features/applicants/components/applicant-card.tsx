import Link from "next/link";
import { ClockIcon, FilmIcon, UserCheckIcon } from "lucide-react";
import { daysBetween } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PipelineApplicant } from "../queries";
import { Stars } from "./star-rating";

/**
 * Pipeline card. The menu (passed in) sits outside the link so there are no
 * nested interactive elements.
 */
export function ApplicantCard({
  applicant,
  today,
  menu,
  overlay = false,
}: {
  applicant: PipelineApplicant;
  today: string;
  menu?: React.ReactNode;
  overlay?: boolean;
}) {
  const daysInStage = Math.max(0, daysBetween(applicant.stageChangedAt.slice(0, 10), today));
  const facts = [
    applicant.hourlyRate !== null && `$${applicant.hourlyRate}/h`,
    applicant.weeklyHours !== null && `${applicant.weeklyHours}h/wk`,
    applicant.timezone?.split("/").pop()?.replace(/_/g, " "),
  ].filter(Boolean);

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card transition-colors hover:border-foreground/20",
        overlay && "border-primary/40 bg-popover",
      )}
    >
      <Link href={`/editors/applicants/${applicant.id}`} className="block rounded-xl p-3.5 pr-10 outline-none" draggable={false}>
        <p className="truncate font-medium">{applicant.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {applicant.specialties.slice(0, 2).join(" · ") || applicant.email}
        </p>

        {applicant.rating !== null && <Stars value={applicant.rating} className="mt-2" />}

        {(applicant.software.length > 0 || facts.length > 0) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {applicant.software.slice(0, 2).map((tool) => (
              <span key={tool} className="rounded-full bg-background/50 px-2 py-0.5 text-xs ring-1 ring-border">
                {tool}
              </span>
            ))}
            {applicant.software.length > 2 && (
              <span className="rounded-full px-1 py-0.5 text-xs text-muted-foreground">+{applicant.software.length - 2}</span>
            )}
          </div>
        )}
        {facts.length > 0 && <p className="mt-2 truncate text-xs text-muted-foreground tabular">{facts.join(" · ")}</p>}

        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {applicant.editorId ? (
            <span className="inline-flex items-center gap-1 text-success">
              <UserCheckIcon className="size-3" /> Account created ·
            </span>
          ) : applicant.column === "test_submitted" && applicant.testSubmissionUrl ? (
            <span className="inline-flex items-center gap-1 text-primary">
              <FilmIcon className="size-3" /> Edit in ·
            </span>
          ) : applicant.column === "test_edit_sent" && applicant.testEditUrl ? (
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3" /> Waiting on test ·
            </span>
          ) : null}
          {applicant.column === "applied"
            ? daysInStage === 0
              ? "Applied today"
              : `Applied ${daysInStage}d ago`
            : daysInStage === 0
              ? "Moved here today"
              : `${daysInStage}d in this stage`}
        </p>
      </Link>
      {menu && <div className="absolute top-2 right-2">{menu}</div>}
    </div>
  );
}
