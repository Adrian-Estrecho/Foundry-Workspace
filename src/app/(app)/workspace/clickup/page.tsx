import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { ClickUpMark } from "@/features/clickup/components/clickup-mark";
import { ClickUpSettings } from "@/features/clickup/components/clickup-settings";
import { ConnectForm } from "@/features/clickup/components/connect-form";
import { getClickUpPage } from "@/features/clickup/queries";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "ClickUp" };

const STEPS = [
  "In ClickUp, click your avatar, then Settings.",
  "Open Apps. Under API Token, click Generate (or Copy if there's one already).",
  "Paste it here.",
];

const HOW_IT_WORKS = [
  "You pick which ClickUp Lists come in, and the status where syncing starts, like Ready to edit.",
  "ClickUp's statuses become your task statuses here.",
  "Title, description, due date, priority and assignee come from ClickUp. Editors are matched by their email.",
  "Moving a task here moves it in ClickUp too.",
];

/** Owners and admins connect ClickUp and pick the pipelines that sync into projects. */
export default async function ClickUpPage() {
  const user = await requireAdmin();
  const data = await getClickUpPage(user.workspace.id);
  const { connection } = data;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/workspace" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Workspace
      </Link>
      <div className="mt-3 mb-6">
        <h1 className="flex items-center gap-2.5 font-heading text-2xl font-semibold tracking-tight">
          <ClickUpMark className="size-6 text-primary" /> ClickUp
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Bring tasks from your ClickUp pipelines into {user.workspace.name}. ClickUp stays in charge of what each task is, and status
          changes go both ways.
        </p>
      </div>

      {connection ? (
        <ClickUpSettings data={{ ...data, connection }} renderedAt={data.renderedAt} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Panel
            title="Connect ClickUp"
            description="Use a personal API token from someone who can see your pipelines, ideally the ClickUp owner or an admin."
          >
            <ol className="mb-6 grid gap-3 text-sm">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-medium text-primary tabular">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <ConnectForm />
          </Panel>
          <Panel title="How it works">
            <ul className="grid gap-3 text-sm text-muted-foreground">
              {HOW_IT_WORKS.map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
