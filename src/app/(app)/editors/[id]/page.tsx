import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarCheckIcon,
  CheckCircle2Icon,
  Clock3Icon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderKanbanIcon,
  RotateCcwIcon,
  UserSearchIcon,
  WalletIcon,
} from "lucide-react";
import { HistoryPanel } from "@/components/shared/history-panel";
import { KpiTile } from "@/components/shared/kpi-tile";
import { EmptyState, Panel } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { PaymentSummary } from "@/features/editors/components/payment-summary";
import { OnboardingDecisionPanel } from "@/features/editors/components/profile/decision-panel";
import { EditorHeader } from "@/features/editors/components/profile/editor-header";
import { InterviewPanel } from "@/features/editors/components/profile/interview-panel";
import { NotesPanel } from "@/features/editors/components/profile/notes-panel";
import { OnboardingPanel } from "@/features/editors/components/profile/onboarding-panel";
import { TrialTaskPanel } from "@/features/editors/components/profile/trial-task-panel";
import { WEEKDAYS } from "@/features/editors/constants";
import { getEditorProfile } from "@/features/editors/queries";
import { requireAdmin } from "@/lib/auth";
import { dueLabel, formatDay, formatDuration, timeAgo, toHours } from "@/lib/dates";
import { TASK_STATUS_LABEL } from "@/lib/status";
import { localTime, zoneCity } from "@/lib/time-zones";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECENT_MS = 3 * 60 * 1000;

export async function generateMetadata(props: PageProps<"/editors/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!UUID.test(id)) return { title: "Editor" };
  const user = await requireAdmin();
  const { profile } = await getEditorProfile(id, user);
  return { title: profile.full_name };
}

export default async function EditorPage(props: PageProps<"/editors/[id]">) {
  const user = await requireAdmin();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();

  const data = await getEditorProfile(id, user);
  const { editor, profile, performance, renderedAt, today } = data;
  const lastSeen = profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
  const workDays = WEEKDAYS.filter((d) => editor.work_days.includes(d.value)).map((d) => d.short);
  const onboarding = data.member?.status === "onboarding";
  const showTrial = onboarding || data.trialTasks.length > 0;
  const missing = data.checklist.filter((item) => !item.is_done).map((item) => item.label);

  return (
    <>
      <RealtimeRefresh
        channel={`editor-${id}`}
        tables="editors,editor_checklist_items,editor_documents,tasks,editor_interviews,workspace_members"
      />
      <EditorHeader
        editor={{
          id: editor.id,
          name: profile.full_name,
          email: profile.email,
          avatarUrl: profile.avatar_url,
          subtitle: [profile.email, `${zoneCity(profile.timezone)} · ${localTime(profile.timezone, renderedAt)}`].join(" · "),
          isActive: editor.is_active,
          workStatus: editor.work_status,
          recentlySeen: renderedAt - lastSeen < RECENT_MS,
          memberStatus: data.member?.status ?? "active",
        }}
        details={{
          software: editor.software,
          specialties: editor.specialties,
          hourlyRate: editor.hourly_rate,
          weeklyHours: editor.weekly_hours,
          workDays: editor.work_days,
          shiftStart: editor.shift_start,
        }}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Hours this week"
          value={`${toHours(data.secondsThisWeek)}h`}
          icon={Clock3Icon}
          hint={editor.weekly_hours ? `of ${editor.weekly_hours}h planned` : "No weekly target"}
        />
        <KpiTile label="Tasks completed" value={performance.completed} icon={CheckCircle2Icon} hint={`${performance.open} open now`} />
        <KpiTile
          label="On time"
          value={performance.onTimeRate === null ? "—" : `${performance.onTimeRate}%`}
          icon={CalendarCheckIcon}
          hint="Done by the due date"
          tone={performance.onTimeRate !== null && performance.onTimeRate >= 80 ? "success" : "default"}
        />
        <KpiTile
          label="Avg revisions"
          value={performance.avgRevisions === null ? "—" : performance.avgRevisions.toFixed(1)}
          icon={RotateCcwIcon}
          hint="Per completed task"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="grid grid-cols-1 content-start gap-5 xl:col-span-8">
          <OnboardingPanel items={data.checklist} completedAt={editor.onboarding_completed_at} renderedAt={renderedAt} />
          {showTrial && (
            <TrialTaskPanel
              editorId={editor.id}
              editorName={profile.full_name}
              tasks={data.trialTasks}
              today={today}
              renderedAt={renderedAt}
            />
          )}
          {(onboarding || data.interviews.length > 0) && (
            <InterviewPanel
              editorId={editor.id}
              editorName={profile.full_name}
              editorTimeZone={profile.timezone}
              adminTimeZone={user.timezone}
              interviews={data.interviews}
            />
          )}

          <Panel title="Recent work" description={`${performance.open} open · latest completed below`}>
            {data.openTasks.length === 0 && data.recentDone.length === 0 ? (
              <EmptyState icon={FolderKanbanIcon} title="No tasks yet" description="Tasks assigned to them show up here." />
            ) : (
              <ul className="divide-y">
                {[...data.openTasks, ...data.recentDone].map((task) => (
                  <li key={task.id}>
                    <Link href={`/tasks/${task.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent/40">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          task.status === "done" ? "bg-success" : task.status === "revisions" ? "bg-danger" : task.status === "for_review" ? "bg-warning" : "bg-primary",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-medium", task.status === "done" && "text-muted-foreground")}>
                          {task.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {task.project?.name ?? "Internal"} · {TASK_STATUS_LABEL[task.status]}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-xs tabular",
                          task.status !== "done" && task.due_date && task.due_date < today ? "text-danger" : "text-muted-foreground",
                        )}
                      >
                        {task.status === "done"
                          ? task.completed_at && `Done ${timeAgo(task.completed_at, renderedAt)}`
                          : task.due_date && dueLabel(task.due_date, today)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent shifts" description="From Start to Stop working.">
            {data.shifts.length === 0 ? (
              <EmptyState icon={Clock3Icon} title="No shifts yet" description="Their working sessions appear here once they start work." />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="pb-2 font-medium">Day</th>
                    <th scope="col" className="pb-2 font-medium">Hours</th>
                    <th scope="col" className="pb-2 font-medium">Breaks</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.shifts.map((shift) => {
                    const open = !shift.clock_out_at;
                    const seconds = open ? (renderedAt - new Date(shift.clock_in_at).getTime()) / 1000 : shift.work_seconds;
                    return (
                      <tr key={shift.id}>
                        <td className="py-2">{formatDay(shift.work_date)}</td>
                        <td className="py-2 tabular">
                          {formatDuration(seconds)}
                          {open && <span className="ml-2 text-xs text-status-working">In progress</span>}
                        </td>
                        <td className="py-2 text-muted-foreground tabular">{open ? "—" : formatDuration(shift.break_seconds)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 content-start gap-5 xl:col-span-4">
          {onboarding && (
            <OnboardingDecisionPanel
              editorId={editor.id}
              editorName={profile.full_name}
              workspaceName={user.workspace.name}
              stepsDone={data.checklist.length - missing.length}
              stepsTotal={data.checklist.length}
              missing={missing}
            />
          )}
          <NotesPanel editorId={editor.id} notes={data.notes} renderedAt={renderedAt} />
          <Panel title="Details">
            <dl className="grid grid-cols-2 gap-4">
              <Fact label="Hourly rate" value={editor.hourly_rate !== null ? `$${editor.hourly_rate}/h` : null} />
              <Fact label="Hours per week" value={editor.weekly_hours !== null ? `${editor.weekly_hours}h` : null} />
              <Fact label="Works" value={workDays.length === 7 ? "Every day" : workDays.join(", ")} />
              <Fact label="Usually starts" value={editor.shift_start.slice(0, 5)} />
              <Fact label="Phone" value={profile.phone} />
              <Fact label="Joined" value={formatDay(editor.created_at.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })} />
            </dl>
            <div className="mt-5 grid gap-3">
              <Chips label="Software" values={editor.software} />
              <Chips label="Specialties" values={editor.specialties} />
            </div>
          </Panel>

          <Panel title="Documents">
            {data.documents.length === 0 ? (
              <EmptyState icon={FileTextIcon} title="No documents yet" description="Their signed contract and NDA appear here." />
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {data.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border">
                    <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-muted-foreground">
                        {doc.doc_type === "nda" ? "NDA" : doc.doc_type === "contract" ? "Contract" : "Document"} ·{" "}
                        {timeAgo(doc.uploaded_at, renderedAt)}
                      </span>
                      <span className="block truncate text-sm font-medium">{doc.file_name}</span>
                    </span>
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${doc.file_name}`}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <ExternalLinkIcon className="size-4" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Payment details" description={data.payment ? `Updated ${timeAgo(data.payment.updated_at, renderedAt)}` : undefined}>
            {data.payment ? (
              <PaymentSummary method={data.payment.method} details={data.payment.details} />
            ) : (
              <EmptyState icon={WalletIcon} title="Not added yet" description="They add these during onboarding." />
            )}
          </Panel>

          {editor.applicant && (
            <Panel title="Application">
              <div className="flex items-center gap-3">
                <UserSearchIcon className="size-5 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 text-sm">
                  Applied {formatDay(editor.applicant.created_at.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}
                  {editor.applicant.rating && <span className="text-muted-foreground"> · rated {editor.applicant.rating}/5</span>}
                </p>
                <Link href={`/editors/applicants/${editor.applicant.id}`} className="text-sm font-medium text-primary hover:underline">
                  Open
                </Link>
              </div>
            </Panel>
          )}

          <HistoryPanel entries={data.activity} renderedAt={renderedAt} />
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
        <p className="mt-1 text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <li key={value} className="rounded-full bg-surface px-2.5 py-0.5 text-xs ring-1 ring-border">
              {value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
