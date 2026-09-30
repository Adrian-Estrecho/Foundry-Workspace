import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { PROJECT_STAGES } from "@/features/projects/constants";
import { StatusList } from "@/features/statuses/components/status-list";
import { getStatusSettings } from "@/features/statuses/queries";
import { TASK_STAGES } from "@/features/tasks/constants";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Statuses" };

/** Owners and admins arrange the workspace's task and project statuses. */
export default async function StatusesPage() {
  const user = await requireAdmin();
  const statuses = await getStatusSettings();

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/workspace" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Workspace
      </Link>
      <div className="mt-3 mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Statuses</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The steps work moves through in {user.workspace.name}. Each status sits in a stage, and the stage decides how it
          behaves, so a status you add works like the others in its stage. Changes save straight away.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Panel
          id="tasks"
          title="Task statuses"
          description="The columns on the task board, and the choices on every task."
          className="scroll-mt-20"
        >
          <StatusList kind="task" stages={TASK_STAGES} statuses={statuses.tasks} />
        </Panel>
        <Panel
          id="projects"
          title="Project statuses"
          description="Where each project is. Clients see a simpler version of the stage in their portal."
          className="scroll-mt-20"
        >
          <StatusList kind="project" stages={PROJECT_STAGES} statuses={statuses.projects} />
        </Panel>
      </div>
    </div>
  );
}
