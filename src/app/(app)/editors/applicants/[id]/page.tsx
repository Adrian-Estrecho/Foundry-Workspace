import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { HistoryPanel } from "@/components/shared/history-panel";
import { Panel } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { ApplicantHeader } from "@/features/applicants/components/detail/applicant-header";
import { DecisionPanel } from "@/features/applicants/components/detail/decision-panel";
import { ReviewPanel } from "@/features/applicants/components/detail/review-panel";
import { getApplicantDetail } from "@/features/applicants/queries";
import { requireAdmin } from "@/lib/auth";
import { timeAgo } from "@/lib/dates";
import { localTime } from "@/lib/time-zones";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(props: PageProps<"/editors/applicants/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!UUID.test(id)) return { title: "Applicant" };
  const { applicant } = await getApplicantDetail(id);
  return { title: applicant.full_name };
}

export default async function ApplicantPage(props: PageProps<"/editors/applicants/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();

  const { applicant, activity, invitation, renderedAt } = await getApplicantDetail(id);

  return (
    <>
      <RealtimeRefresh channel={`applicant-${id}`} tables="applicants,workspace_invitations" />
      <ApplicantHeader
        applicant={{
          id: applicant.id,
          name: applicant.full_name,
          email: applicant.email,
          stage: applicant.stage,
          editorId: applicant.editor_id,
          appliedLabel: `Applied ${timeAgo(applicant.created_at, renderedAt)}`,
        }}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="grid grid-cols-1 content-start gap-5 xl:col-span-8">
          <Panel
            title="Application"
            action={
              applicant.portfolio_url && (
                <a
                  href={applicant.portfolio_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1 text-sm font-medium text-primary ring-1 ring-primary/25 hover:bg-primary/20"
                >
                  <ExternalLinkIcon className="size-3.5" /> Portfolio
                </a>
              )
            }
          >
            <dl className="grid gap-4 sm:grid-cols-3">
              <Fact label="Hourly rate" value={applicant.hourly_rate !== null ? `$${applicant.hourly_rate}/h` : null} />
              <Fact label="Hours per week" value={applicant.weekly_hours !== null ? `${applicant.weekly_hours}h` : null} />
              <Fact
                label="Timezone"
                value={applicant.timezone && `${applicant.timezone.replace(/_/g, " ")} · ${localTime(applicant.timezone, renderedAt)}`}
              />
            </dl>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Chips label="Software" values={applicant.software} />
              <Chips label="Specialties" values={applicant.specialties} />
            </div>
            {applicant.availability_notes && (
              <div className="mt-5">
                <p className="text-xs text-muted-foreground">Availability</p>
                <p className="mt-1.5 rounded-2xl bg-surface p-3 text-sm whitespace-pre-line ring-1 ring-border">
                  {applicant.availability_notes}
                </p>
              </div>
            )}
          </Panel>

          <ReviewPanel applicantId={applicant.id} rating={applicant.rating} notes={applicant.admin_notes} />
        </div>

        <div className="grid grid-cols-1 content-start gap-5 xl:col-span-4">
          <DecisionPanel
            applicant={{
              id: applicant.id,
              name: applicant.full_name,
              email: applicant.email,
              stage: applicant.stage,
              editorId: applicant.editor_id,
            }}
            invitation={invitation}
          />
          <HistoryPanel entries={activity} renderedAt={renderedAt} />
        </div>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

function Chips({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {values.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <li key={value} className="rounded-full bg-surface px-2.5 py-0.5 text-sm ring-1 ring-border">
              {value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
