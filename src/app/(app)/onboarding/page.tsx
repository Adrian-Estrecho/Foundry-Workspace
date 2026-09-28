import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PartyPopperIcon } from "lucide-react";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { Button } from "@/components/ui/button";
import { AUTO_STEP_HINTS } from "@/features/editors/constants";
import { DocumentsStep } from "@/features/editors/components/onboarding/documents-step";
import { LinkStep } from "@/features/editors/components/onboarding/link-step";
import { PaymentStep } from "@/features/editors/components/onboarding/payment-step";
import { SopsStep } from "@/features/editors/components/onboarding/sops-step";
import { StepCard } from "@/features/editors/components/onboarding/step-card";
import { TrialStep } from "@/features/editors/components/onboarding/trial-step";
import { getOnboarding } from "@/features/editors/queries";
import { requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { cn, firstName } from "@/lib/utils";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.role !== "editor") redirect("/editors");

  const data = await getOnboarding(user);
  const today = todayIn(user.timezone);
  const done = (key: string) => data.checklist.find((item) => item.key === key)?.is_done ?? false;
  const doneCount = data.checklist.filter((item) => item.is_done).length;
  const total = data.checklist.length;
  const currentKey = data.checklist.find((item) => !item.is_done)?.key;
  const step = (key: string) => ({ done: done(key), current: key === currentKey, autoHint: AUTO_STEP_HINTS[key], id: key });
  const sopsLeft = data.sops.filter((sop) => !sop.acknowledgedAt).length;

  return (
    <>
      <RealtimeRefresh channel="onboarding" tables="editor_checklist_items,tasks" />
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Welcome to Foundry, {firstName(user.full_name)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Six steps to get you set up. Most of them tick themselves as you go.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <div
                className={cn("h-full rounded-full transition-all", doneCount === total ? "bg-success" : "bg-primary")}
                style={{ width: `${(doneCount / Math.max(1, total)) * 100}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground tabular">
              {doneCount} of {total} done
            </span>
          </div>
        </div>

        {data.completedAt && (
          <section className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-success/30 bg-success/8 p-5">
            <span className="grid size-11 place-items-center rounded-xl bg-success/15 text-success">
              <PartyPopperIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-base font-medium">You&apos;re all set</h2>
              <p className="text-sm text-muted-foreground">Onboarding is complete and the team knows you&apos;re ready for projects.</p>
            </div>
            <Button asChild>
              <Link href="/dashboard">Go to your dashboard</Link>
            </Button>
          </section>
        )}

        <div className="grid grid-cols-1 gap-4">
          <StepCard
            number={1}
            title="Upload your signed contract and NDA"
            description="Download the documents, sign them, then upload both here."
            {...step("contract_nda")}
          >
            <DocumentsStep editorId={user.id} documents={data.documents} templatesUrl={data.links.contractTemplates} />
          </StepCard>

          <StepCard number={2} title="Add your payment details" description="So we know where to send your pay." {...step("payment_details")}>
            <PaymentStep payment={data.payment} />
          </StepCard>

          <StepCard
            number={3}
            title="Join the Frame.io workspace"
            description="All reviews happen in Frame.io. Accept the invite, then tick this off."
            {...step("frameio")}
          >
            <LinkStep
              stepKey="frameio"
              done={done("frameio")}
              href={data.links.frameio}
              openLabel="Open the Frame.io invite"
              doneLabel="I've joined"
              missingText="Your admin will send you the Frame.io invite."
            />
          </StepCard>

          <StepCard
            number={4}
            title="Read the required SOPs"
            description={
              data.sops.length === 0
                ? "How we work at Foundry."
                : sopsLeft === 0
                  ? "All read. Thanks!"
                  : `How we work at Foundry. ${sopsLeft} left to read.`
            }
            {...step("sops")}
          >
            <SopsStep sops={data.sops} renderedAt={data.renderedAt} />
          </StepCard>

          <StepCard
            number={5}
            title="Download the editor asset pack"
            description="Fonts, LUTs, SFX and templates we use on client work."
            {...step("asset_pack")}
          >
            <LinkStep
              stepKey="asset_pack"
              done={done("asset_pack")}
              href={data.links.assetPack}
              openLabel="Open the asset pack"
              doneLabel="I've downloaded it"
              missingText="Your admin will share the asset pack with you."
            />
          </StepCard>

          <StepCard
            number={6}
            title="Complete your trial task"
            description="A short, real-world task so we can see how you work. Hand in a link when you're done."
            {...step("trial_task")}
          >
            <TrialStep tasks={data.trialTasks} today={today} renderedAt={data.renderedAt} />
          </StepCard>
        </div>
      </div>
    </>
  );
}
