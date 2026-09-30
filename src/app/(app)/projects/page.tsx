import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { getEditorOptions } from "@/features/clients/queries";
import { projectAccess } from "@/features/projects/access";
import { ProjectList } from "@/features/projects/components/project-list";
import { getClientChoices, getProjects } from "@/features/projects/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const access = projectAccess(user);
  const [{ projects, statuses, today }, clients, editors] = await Promise.all([
    getProjects(user),
    access.manage ? getClientChoices(user) : Promise.resolve([]),
    access.manage ? getEditorOptions() : Promise.resolve([]),
  ]);
  const active = projects.filter((p) => p.status !== "delivered");
  const late = active.filter((p) => p.deadline && p.deadline < today).length;

  return (
    <>
      <RealtimeRefresh channel="projects" tables="projects,project_editors,tasks" />
      <PageHeader
        title="Projects"
        description={
          access.manage || access.clients
            ? `${active.length} active · ${late} past deadline · ${projects.length - active.length} delivered`
            : "The client projects you're working on."
        }
      />
      <ProjectList projects={projects} statuses={statuses} today={today} access={access} clients={clients} editors={editors} />
    </>
  );
}
