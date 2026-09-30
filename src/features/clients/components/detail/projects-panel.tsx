"use client";

import * as React from "react";
import Link from "next/link";
import { FolderKanbanIcon, PlusIcon } from "lucide-react";
import { EmptyState, Panel } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { ProjectFormDialog, type EditorOption } from "@/features/projects/components/project-form-dialog";
import { PROJECT_STAGES, type ProjectStatus } from "@/features/projects/constants";
import { StatusDot } from "@/features/statuses/components/status-chip";
import { dueLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  /** The workspace's status; the stage's name is shown if it's missing. */
  statusInfo: { name: string; color: string } | null;
  deadline: string | null;
  editors: { id: string; name: string; avatarUrl: string | null }[];
};

export function ProjectsPanel({
  client,
  projects,
  editors,
  today,
  canCreate,
}: {
  client: { id: string; name: string; driveFolderUrl: string | null; deadline: string | null };
  /** Needs project management. */
  canCreate: boolean;
  projects: Project[];
  editors: EditorOption[];
  today: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Panel
      title="Projects"
      description={projects.length ? `${projects.length} ${projects.length === 1 ? "project" : "projects"}` : undefined}
      action={
        canCreate && (
          <Button size="sm" variant="secondary" className="bg-surface-strong ring-1 ring-border" onClick={() => setOpen(true)}>
            <PlusIcon /> New project
          </Button>
        )
      }
    >
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanbanIcon}
          title="No projects yet"
          description="Create the first project when the client reaches Kickoff."
          action={canCreate ? <Button onClick={() => setOpen(true)}>Create first project</Button> : undefined}
        />
      ) : (
        <ul className="grid gap-2">
          {projects.map((project) => {
            const status = project.statusInfo ?? {
              name: PROJECT_STAGES.find((s) => s.value === project.status)?.label ?? project.status,
              color: "grey",
            };
            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border transition-colors hover:bg-accent/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{project.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <StatusDot color={status.color} /> {status.name}
                      {project.deadline && project.status !== "delivered" && (
                        <span className={cn(project.deadline < today && "text-danger")}> · {dueLabel(project.deadline, today)}</span>
                      )}
                    </span>
                  </span>
                  <span className="flex -space-x-2">
                    {project.editors.slice(0, 4).map((editor) => (
                      <UserAvatar key={editor.id} name={editor.name} src={editor.avatarUrl} className="size-8 ring-2 ring-background" />
                    ))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <ProjectFormDialog open={open} onOpenChange={setOpen} client={client} editors={editors} />
    </Panel>
  );
}
