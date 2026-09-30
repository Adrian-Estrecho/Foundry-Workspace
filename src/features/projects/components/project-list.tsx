"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarIcon,
  EyeIcon,
  FolderKanbanIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
} from "lucide-react";
import { NativeSelect } from "@/components/shared/form";
import { EmptyState } from "@/components/shared/panel";
import { Segmented } from "@/components/shared/segmented";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusDot } from "@/features/statuses/components/status-chip";
import { Input } from "@/components/ui/input";
import { dueLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { setProjectStatus } from "../actions";
import type { ProjectStatusDef } from "../constants";
import type { ProjectSummary } from "../queries";
import { ProjectFormDialog, type ClientChoice, type EditorOption } from "./project-form-dialog";
import { ProjectStatusChip } from "./project-status";

type Scope = "active" | "delivered" | "all";

/** Project cards with task progress. Admins can add projects and change status from each card. */
export function ProjectList({
  projects,
  statuses,
  today,
  isAdmin,
  clients,
  editors,
}: {
  projects: ProjectSummary[];
  statuses: ProjectStatusDef[];
  today: string;
  isAdmin: boolean;
  clients: ClientChoice[];
  editors: EditorOption[];
}) {
  const [scope, setScope] = React.useState<Scope>("active");
  const [client, setClient] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const projectClients = [...new Map(projects.map((p) => [p.client.id, p.client.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const q = query.trim().toLowerCase();
  const visible = projects
    .filter((p) => (scope === "active" ? p.status !== "delivered" : scope === "delivered" ? p.status === "delivered" : true))
    .filter((p) => !client || p.client.id === client)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.client.name.toLowerCase().includes(q))
    .sort((a, b) =>
      scope === "delivered"
        ? (b.deliveredAt ?? "").localeCompare(a.deliveredAt ?? "")
        : (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"),
    );
  const counts = {
    active: projects.filter((p) => p.status !== "delivered").length,
    delivered: projects.filter((p) => p.status === "delivered").length,
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Segmented
          label="Show"
          value={scope}
          onChange={setScope}
          options={[
            { value: "active", label: `Active · ${counts.active}` },
            { value: "delivered", label: `Delivered · ${counts.delivered}` },
            { value: "all", label: "All" },
          ]}
        />
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
            className="h-9 rounded-full bg-card pl-9"
          />
        </div>
        {projectClients.length > 1 && (
          <NativeSelect aria-label="Client" value={client} onChange={(event) => setClient(event.target.value)} className="h-9 w-full rounded-lg bg-card sm:w-48">
            <option value="">All clients</option>
            {projectClients.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </NativeSelect>
        )}
        {isAdmin && (
          <Button onClick={() => setCreating(true)} className="sm:ml-auto">
            <PlusIcon /> New project
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={FolderKanbanIcon}
            title={projects.length === 0 ? "No projects yet" : "No projects match"}
            description={
              projects.length === 0
                ? isAdmin
                  ? "Projects are usually created when a client reaches Kickoff. You can also add one here."
                  : "Projects you're assigned to show up here."
                : "Try another filter."
            }
            action={isAdmin && projects.length === 0 ? <Button onClick={() => setCreating(true)}>Create a project</Button> : undefined}
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {visible.map((project) => (
            <ProjectCard key={project.id} project={project} statuses={statuses} today={today} isAdmin={isAdmin} />
          ))}
        </ul>
      )}

      {isAdmin && creating && (
        <ProjectFormDialog open onOpenChange={setCreating} clients={clients} editors={editors} />
      )}
    </>
  );
}

function ProjectCard({
  project,
  statuses,
  today,
  isAdmin,
}: {
  project: ProjectSummary;
  statuses: ProjectStatusDef[];
  today: string;
  isAdmin: boolean;
}) {
  const delivered = project.status === "delivered";
  const late = !delivered && project.deadline !== null && project.deadline < today;
  const pct = project.tasks.total ? Math.round((project.tasks.done / project.tasks.total) * 100) : 0;

  return (
    <li className={cn("group relative rounded-xl border bg-card transition-colors hover:border-foreground/20", late && "border-danger/35")}>
      <Link href={`/projects/${project.id}`} className="block rounded-xl p-4 pr-12 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <p className="truncate text-xs text-muted-foreground">{project.client.name}</p>
        <p className="mt-0.5 truncate font-heading text-base font-medium">{project.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <ProjectStatusChip status={project.statusInfo} />
          {project.deadline && (
            <span className={cn("inline-flex items-center gap-1 text-xs tabular", late ? "font-medium text-danger" : "text-muted-foreground")}>
              <CalendarIcon className="size-3" />
              {delivered ? "Delivered" : dueLabel(project.deadline, today)}
            </span>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{isAdmin ? "Tasks" : "Your tasks"}</span>
            <span className="tabular">
              {project.tasks.done}/{project.tasks.total} done
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/10">
            <div className={cn("h-full rounded-full", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs">
          {project.tasks.overdue > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-danger">
              <AlertTriangleIcon className="size-3.5" /> {project.tasks.overdue} overdue
            </span>
          )}
          {project.tasks.forReview > 0 && (
            <span className="inline-flex items-center gap-1 text-warning">
              <EyeIcon className="size-3.5" /> {project.tasks.forReview} for review
            </span>
          )}
          <span className="ml-auto flex -space-x-2">
            {project.editors.slice(0, 4).map((editor) => (
              <UserAvatar key={editor.id} name={editor.name} src={editor.avatarUrl} className="size-7 ring-2 ring-card" />
            ))}
            {project.editors.length > 4 && (
              <span className="grid size-7 place-items-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-card">
                +{project.editors.length - 4}
              </span>
            )}
          </span>
        </div>
      </Link>
      {isAdmin && (
        <div className="absolute top-3 right-3">
          <StatusMenu project={project} statuses={statuses} />
        </div>
      )}
    </li>
  );
}

function StatusMenu({ project, statuses }: { project: ProjectSummary; statuses: ProjectStatusDef[] }) {
  const router = useRouter();
  const move = async (status: ProjectStatusDef) => {
    const result = await setProjectStatus(project.id, status.id);
    if (!result.ok) return void toast.error(result.error);
    toast.success(`${project.name} moved to ${status.name}`);
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full opacity-60 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Actions for ${project.name}`}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-52 overflow-y-auto rounded-2xl">
        <DropdownMenuItem asChild>
          <Link href={`/projects/${project.id}`}>
            <ArrowRightIcon /> Open project
          </Link>
        </DropdownMenuItem>
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {statuses
          .filter((s) => s.id !== project.statusInfo.id)
          .map((status) => (
            <DropdownMenuItem key={status.id} onSelect={() => void move(status)}>
              <StatusDot color={status.color} /> <span className="truncate">{status.name}</span>
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/workspace/statuses#projects">
            <Settings2Icon /> Edit statuses
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
