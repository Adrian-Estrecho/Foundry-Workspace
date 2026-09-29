import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, CheckIcon, ClapperboardIcon, HourglassIcon, VideoIcon } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrialStatusChip } from "@/features/editors/components/trial-task-view";
import { interviewTime } from "@/features/editors/interview";
import { onboardingSteps } from "@/features/editors/onboarding-steps";
import type { getOnboarding } from "@/features/editors/queries";
import type { CurrentUser } from "@/lib/auth";
import { dueLabel, greeting } from "@/lib/dates";
import { cn, firstName } from "@/lib/utils";

type Data = Awaited<ReturnType<typeof getOnboarding>>;

/**
 * The dashboard of an editor still onboarding: how far they've got, what's
 * next, their test edit, interview and SOPs. The rest of the workspace opens
 * once they're approved.
 */
export function OnboardingDashboard({ user, data, today }: { user: CurrentUser; data: Data; today: string }) {
  const workspace = user.workspace.name;
  const trial = data.trialTasks[0] ?? null;
  const steps = onboardingSteps(data.checklist, trial?.status ?? null);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const sopsLeft = data.sops.filter((sop) => !sop.acknowledgedAt).length;
  const interview = data.interview?.outcome === "scheduled" ? data.interview : null;

  return (
    <>
      <RealtimeRefresh channel="onboarding-dashboard" tables="editor_checklist_items,tasks,editor_interviews,workspace_members" />
      <PageHeader
        title={`${greeting(user.timezone)}, ${firstName(user.full_name)}`}
        description={`You're onboarding with ${workspace}. Finish the steps below and they'll approve you.`}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="grid grid-cols-1 content-start gap-5 xl:col-span-8">
          <Panel
            title="Your onboarding"
            description={next ? `Next: ${next.label}` : `Everything's in. ${workspace} will confirm your place soon.`}
            action={
              <Button asChild size="sm">
                <Link href="/onboarding">
                  {next ? "Continue" : "Open"} <ArrowRightIcon />
                </Link>
              </Button>
            }
          >
            <div className="flex items-center gap-3">
              <Progress value={(done / steps.length) * 100} className="h-2 flex-1" />
              <span className="text-sm text-muted-foreground tabular">
                {done} of {steps.length}
              </span>
            </div>
            <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {steps.map((step) => (
                <li key={step.key} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full ring-1",
                      step.done ? "bg-success/15 text-success ring-success/30" : "bg-muted ring-border",
                      step.key === next?.key && "ring-primary",
                    )}
                  >
                    {step.done && <CheckIcon className="size-3" />}
                  </span>
                  <span className={cn(step.done && "text-muted-foreground")}>{step.label}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Test edit">
            {trial ? (
              <Link
                href="/onboarding#test_edit"
                className="flex items-center gap-3 rounded-lg bg-surface p-3 ring-1 ring-border hover:bg-accent/50"
              >
                <ClapperboardIcon className="size-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{trial.title}</span>
                  {trial.due_date && trial.status !== "done" && (
                    <span className="block text-xs text-muted-foreground">{dueLabel(trial.due_date, today)}</span>
                  )}
                </span>
                <TrialStatusChip status={trial.status} />
              </Link>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <HourglassIcon className="size-4" /> {workspace} will send your test edit soon.
              </p>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 content-start gap-5 xl:col-span-4">
          <Panel title="Interview">
            {interview ? (
              <div className="grid gap-3">
                <p className="text-sm">
                  <span className="block font-medium">{interviewTime(interview.scheduled_at, user.timezone)}</span>
                  <span className="text-muted-foreground">{interview.duration_minutes} minutes, your time</span>
                </p>
                {interview.meeting_url && (
                  <Button asChild variant="secondary" className="bg-surface ring-1 ring-border">
                    <a href={interview.meeting_url} target="_blank" rel="noreferrer">
                      <VideoIcon /> Join the call
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {data.interview?.outcome === "passed"
                  ? "You passed your interview."
                  : `${workspace} will book a short call with you. It'll show up here.`}
              </p>
            )}
          </Panel>

          <Panel title="SOPs">
            <Link href="/sops" className="flex items-center gap-3 rounded-lg bg-surface p-3 ring-1 ring-border hover:bg-accent/50">
              <BookOpenIcon className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-medium">How we work</span>
                <span className="block text-muted-foreground">
                  {sopsLeft > 0 ? `${sopsLeft} required ${sopsLeft === 1 ? "SOP" : "SOPs"} to read` : "Required SOPs all read"}
                </span>
              </span>
              <ArrowRightIcon className="size-4 text-muted-foreground" />
            </Link>
          </Panel>
        </div>
      </div>
    </>
  );
}
