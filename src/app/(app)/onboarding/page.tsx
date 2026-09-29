import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HourglassIcon, PartyPopperIcon } from "lucide-react";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { Button } from "@/components/ui/button";
import { AUTO_STEP_HINTS } from "@/features/editors/constants";
import { DocumentsStep } from "@/features/editors/components/onboarding/documents-step";
import { InterviewStep } from "@/features/editors/components/onboarding/interview-step";
import { LinkStep } from "@/features/editors/components/onboarding/link-step";
import { PaymentStep } from "@/features/editors/components/onboarding/payment-step";
import { ReviewStatus } from "@/features/editors/components/onboarding/review-status";
import { SopsStep } from "@/features/editors/components/onboarding/sops-step";
import { StepCard } from "@/features/editors/components/onboarding/step-card";
import { TrialStep } from "@/features/editors/components/onboarding/trial-step";
import { onboardingSteps } from "@/features/editors/onboarding-steps";
import { getOnboarding } from "@/features/editors/queries";
import { isOnboarding, requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { cn, firstName } from "@/lib/utils";

export const metadata: Metadata = { title: "Onboarding" };

/**
 * An editor's way in: setup steps, the test edit and its review, the
 * interview, then the workspace's approval. Until they're approved this (with
 * their dashboard, SOPs and settings) is all they can open.
 */
export default async function OnboardingPage() {
  const user = await requireUser({ allowOnboarding: true });
  if (user.role !== "editor") redirect("/editors");

  const data = await getOnboarding(user);
  const workspace = user.workspace.name;
  const today = todayIn(user.timezone);
  const checked = (key: string) => data.checklist.find((item) => item.key === key)?.is_done ?? false;
  const trial = data.trialTasks[0] ?? null;
  const sopsLeft = data.sops.filter((sop) => !sop.acknowledgedAt).length;

  const steps = onboardingSteps(data.checklist, trial?.status ?? null);
  const doneCount = steps.filter((s) => s.done).length;
  const currentKey = steps.find((s) => !s.done)?.key;
  const step = (key: string, number: number) => ({
    number,
    done: steps.find((s) => s.key === key)!.done,
    current: key === currentKey,
    autoHint: AUTO_STEP_HINTS[key],
    id: key,
  });
  const approved = !isOnboarding(user);
  const allDone = doneCount === steps.length;

  return (
    <>
      <RealtimeRefresh
        channel="onboarding"
        tables="editor_checklist_items,tasks,task_comments,editor_interviews,workspace_members"
      />
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Welcome to {workspace}, {firstName(user.full_name)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Get set up, show us your editing with a short test, and meet the team. {workspace} approves you at the end, and
            then the whole workspace opens up.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <div
                className={cn("h-full rounded-full transition-all", allDone ? "bg-success" : "bg-primary")}
                style={{ width: `${(doneCount / steps.length) * 100}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground tabular">
              {doneCount} of {steps.length} done
            </span>
          </div>
        </div>

        {approved ? (
          <Banner tone="success" icon={PartyPopperIcon} title="You're in" body={`${workspace} approved you. Your full workspace is open.`}>
            <Button asChild>
              <Link href="/dashboard">Go to your dashboard</Link>
            </Button>
          </Banner>
        ) : (
          allDone && (
            <Banner
              tone="waiting"
              icon={HourglassIcon}
              title="Everything's in"
              body={`${workspace} has been told you're ready. You'll get a notification and an email when they approve you.`}
            />
          )
        )}

        <Section title="Get set up">
          <StepCard
            {...step("contract_nda", 1)}
            title="Upload your signed contract and NDA"
            description="Download the documents, sign them, then upload both here."
          >
            <DocumentsStep
              workspaceId={user.workspace.id}
              editorId={user.id}
              documents={data.documents}
              templatesUrl={data.links.contractTemplates}
            />
          </StepCard>

          <StepCard {...step("payment_details", 2)} title="Add your payment details" description="So we know where to send your pay.">
            <PaymentStep payment={data.payment} />
          </StepCard>

          <StepCard
            {...step("frameio", 3)}
            title="Join the Frame.io workspace"
            description="All reviews happen in Frame.io. Accept the invite, then tick this off."
          >
            <LinkStep
              stepKey="frameio"
              done={checked("frameio")}
              href={data.links.frameio}
              openLabel="Open the Frame.io invite"
              doneLabel="I've joined"
              missingText={`${workspace} will send you the Frame.io invite.`}
            />
          </StepCard>

          <StepCard
            {...step("sops", 4)}
            title="Read the required SOPs"
            description={
              data.sops.length === 0
                ? `How we work at ${workspace}.`
                : sopsLeft === 0
                  ? "All read. Thanks!"
                  : `How we work at ${workspace}. ${sopsLeft} left to read.`
            }
          >
            <SopsStep sops={data.sops} renderedAt={data.renderedAt} />
          </StepCard>

          <StepCard
            {...step("asset_pack", 5)}
            title="Download the editor asset pack"
            description="Fonts, LUTs, SFX and templates we use on client work."
          >
            <LinkStep
              stepKey="asset_pack"
              done={checked("asset_pack")}
              href={data.links.assetPack}
              openLabel="Open the asset pack"
              doneLabel="I've downloaded it"
              missingText={`${workspace} will share the asset pack with you.`}
            />
          </StepCard>
        </Section>

        <Section title="Test edit">
          <StepCard
            {...step("test_edit", 6)}
            title="Do your test edit"
            description="A short, real-world task so we can see how you work. Hand it in with a link."
          >
            <TrialStep tasks={data.trialTasks} today={today} renderedAt={data.renderedAt} workspaceName={workspace} />
          </StepCard>

          <StepCard
            {...step("trial_task", 7)}
            title="Test review"
            description={`${workspace} watches your edit, then passes it or asks for changes.`}
          >
            <ReviewStatus status={trial?.status ?? null} workspaceName={workspace} />
          </StepCard>
        </Section>

        <Section title="Interview">
          <StepCard
            {...step("interview", 8)}
            title="Meet the team"
            description="A short video call: your work, how you like to work, and your questions."
          >
            <InterviewStep interview={data.interview} timeZone={user.timezone} workspaceName={workspace} />
          </StepCard>
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 grid grid-cols-1 gap-4">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Banner({
  tone,
  icon: Icon,
  title,
  body,
  children,
}: {
  tone: "success" | "waiting";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "mb-2 flex flex-wrap items-center gap-4 rounded-xl border p-5",
        tone === "success" ? "border-success/30 bg-success/8" : "bg-card",
      )}
    >
      <span
        className={cn(
          "grid size-11 place-items-center rounded-xl",
          tone === "success" ? "bg-success/15 text-success" : "bg-primary/12 text-primary",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-heading text-base font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      {children}
    </section>
  );
}
