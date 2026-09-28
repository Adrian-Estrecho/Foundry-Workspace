import type { ComponentType } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlarmClockIcon,
  CalendarIcon,
  Clock3Icon,
  ExternalLinkIcon,
  EyeIcon,
  FolderOpenIcon,
  ListTodoIcon,
  PlayCircleIcon,
  UsersIcon,
} from "lucide-react";
import { HistoryPanel } from "@/components/shared/history-panel";
import { KpiTile } from "@/components/shared/kpi-tile";
import { EmptyState, Panel } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ProjectHeader } from "@/features/projects/components/project-header";
import { ProjectTasks } from "@/features/projects/components/project-tasks";
import { RECENT_DONE_DAYS } from "@/features/tasks/constants";
import { getClientChoices, getProjectDetail } from "@/features/projects/queries";
import { requireUser } from "@/lib/auth";
import { formatDay, formatDuration, relativeDue } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(props: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!UUID.test(id)) return { title: "Project" };
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Project" };
}

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();

  const isAdmin = user.role === "admin";
  const [data, clients] = await Promise.all([getProjectDetail(id, user), isAdmin ? getClientChoices() : Promise.resolve([])]);
  const { project, client, team, tasks, today, renderedAt } = data;

  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).length;
  const forReview = tasks.filter((t) => t.status === "for_review").length;
  const totalSeconds = data.time.reduce((sum, row) => sum + row.seconds, 0);
  const delivered = project.status === "delivered";
  const specs = [
    { label: "Format", value: project.spec_format },
    { label: "Aspect ratio", value: project.spec_aspect_ratio },
    { label: "Length", value: project.spec_length },
  ];

  return (
    <>
      <RealtimeRefresh channel={`project-${id}`} tables="projects,project_editors,tasks,subtasks,task_comments" />
      <ProjectHeader
        project={{
          id: project.id,
          clientId: project.client_id,
          name: project.name,
          status: project.status,
          deadline: project.deadline,
          driveFolderUrl: project.drive_folder_url,
          frameioUrl: project.frameio_url,
          specFormat: project.spec_format,
          specAspectRatio: project.spec_aspect_ratio,
          specLength: project.spec_length,
          specNotes: project.spec_notes,
          team,
        }}
        client={client}
        isAdmin={isAdmin}
        taskCount={tasks.length}
        clients={clients}
        editors={data.editorOptions}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label={isAdmin ? "Open tasks" : "Your open tasks"} value={open.length} icon={ListTodoIcon} hint={`${tasks.length - open.length} done`} />
        <KpiTile label="Overdue" value={overdue} icon={AlarmClockIcon} tone={overdue > 0 ? "danger" : "default"} hint={overdue > 0 ? "Needs attention" : "All on track"} />
        <KpiTile label="Waiting for review" value={forReview} icon={EyeIcon} />
        <KpiTile
          label={isAdmin ? "Hours logged" : "Your hours"}
          value={formatDuration(totalSeconds).replace("<1m", "0h")}
          icon={Clock3Icon}
          hint={project.deadline ? (delivered ? "Delivered" : `Deadline ${formatDay(project.deadline, { month: "short", day: "numeric" })}`) : undefined}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Deliverables">
          <dl className="grid grid-cols-3 gap-3">
            {specs.map((spec) => (
              <div key={spec.label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{spec.label}</dt>
                <dd className="mt-0.5 truncate text-sm font-medium">{spec.value || "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <CalendarIcon className="size-4 text-muted-foreground" />
            {project.deadline ? (
              <span className={cn(!delivered && project.deadline < today && "font-medium text-danger")}>
                {formatDay(project.deadline, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                {!delivered && <span className="text-muted-foreground"> · {relativeDue(project.deadline, today)}</span>}
              </span>
            ) : (
              <span className="text-muted-foreground">No deadline set</span>
            )}
          </div>
          {project.spec_notes && (
            <p className="mt-3 rounded-lg bg-surface p-3 text-sm break-words whitespace-pre-line ring-1 ring-border">{project.spec_notes}</p>
          )}
        </Panel>

        <Panel title="Links">
          <ul className="grid grid-cols-1 gap-2">
            <ProjectLink icon={FolderOpenIcon} label="Google Drive folder" href={project.drive_folder_url} />
            <ProjectLink icon={PlayCircleIcon} label="Frame.io review" href={project.frameio_url} />
          </ul>
          {isAdmin && !project.drive_folder_url && !project.frameio_url && (
            <p className="mt-3 text-xs text-muted-foreground">Add links with Edit so editors can find the footage.</p>
          )}
        </Panel>

        <Panel title="Team" description={team.length ? `${team.length} ${team.length === 1 ? "editor" : "editors"}` : undefined}>
          {team.length === 0 ? (
            <EmptyState icon={UsersIcon} title="No editors yet" description="Assign a task or use Edit to add editors." className="py-4" />
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {team.map((editor) => {
                const openTasks = open.filter((t) => t.assignee?.id === editor.id).length;
                const row = (
                  <>
                    <UserAvatar name={editor.name} src={editor.avatarUrl} className="size-8" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {editor.name}
                        {editor.id === user.id && <span className="font-normal text-muted-foreground"> (you)</span>}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {!editor.isActive ? "Inactive" : isAdmin || editor.id === user.id ? `${openTasks} open ${openTasks === 1 ? "task" : "tasks"}` : "Editor"}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={editor.id}>
                    {isAdmin ? (
                      <Link href={`/editors/${editor.id}`} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-accent/50">
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 p-1.5">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <ProjectTasks
        projectId={project.id}
        tasks={tasks}
        isAdmin={isAdmin}
        today={today}
        doneSince={new Date(renderedAt - RECENT_DONE_DAYS * 86_400_000).toISOString()}
        options={data.taskOptions}
      />

      <div className={cn("mt-6 grid grid-cols-1 gap-5", isAdmin && "lg:grid-cols-2")}>
        <Panel title="Time logged" description={totalSeconds > 0 ? `${formatDuration(totalSeconds)} across all tasks` : undefined}>
          {data.time.length === 0 ? (
            <EmptyState icon={Clock3Icon} title="No time logged yet" description="Hours show here as editors work on this project's tasks." />
          ) : (
            <ul className="grid grid-cols-1 gap-3">
              {data.time.map((row) => (
                <li key={row.editorId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{row.name}</span>
                    <span className="font-medium tabular">{formatDuration(row.seconds)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(row.seconds / Math.max(1, totalSeconds)) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {isAdmin && <HistoryPanel entries={data.activity} renderedAt={renderedAt} />}
      </div>
    </>
  );
}

function ProjectLink({ icon: Icon, label, href }: { icon: ComponentType<{ className?: string }>; label: string; href: string | null }) {
  return (
    <li>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-lg bg-surface p-2.5 ring-1 ring-border transition-colors hover:bg-accent/50"
        >
          <Icon className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{label}</span>
            <span className="block truncate text-xs text-muted-foreground">{href.replace(/^https?:\/\//, "")}</span>
          </span>
          <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
        </a>
      ) : (
        <span className="flex items-center gap-3 rounded-lg border border-dashed p-2.5 text-sm text-muted-foreground">
          <Icon className="size-5 shrink-0" />
          {label}: not added
        </span>
      )}
    </li>
  );
}
