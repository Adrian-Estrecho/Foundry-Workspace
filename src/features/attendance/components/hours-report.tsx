import Link from "next/link";
import { ChevronRightIcon, Clock3Icon } from "lucide-react";
import { EmptyState, Panel } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatDuration } from "@/lib/dates";
import type { HoursProject } from "../queries";

const duration = (seconds: number) => formatDuration(seconds).replace("<1m", "0m");

/**
 * Where the time went: per client project (open one for its tasks and who
 * worked on them), and per editor for admins.
 */
export function HoursReport({
  projects,
  editors,
  total,
  team,
}: {
  projects: HoursProject[];
  editors: { id: string; name: string; avatarUrl: string | null; seconds: number }[];
  total: number;
  team: boolean;
}) {
  if (total === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState icon={Clock3Icon} title="No time logged in this range" description="Pick another range, or check back once work starts." />
      </div>
    );
  }

  return (
    <div className={team ? "grid grid-cols-1 gap-5 xl:grid-cols-3" : "grid grid-cols-1 gap-5"}>
      <Panel title="By project" description={`${duration(total)} in total`} className={team ? "xl:col-span-2" : undefined}>
        <ul className="grid grid-cols-1 gap-2">
          {projects.map((project) => (
            <li key={project.key}>
              <details className="group rounded-lg bg-surface ring-1 ring-border">
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{project.projectName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{project.clientName ?? "No client"}</span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-foreground/10">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(project.seconds / total) * 100}%` }} />
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-medium tabular">{duration(project.seconds)}</span>
                    <span className="block text-xs text-muted-foreground tabular">{Math.round((project.seconds / total) * 100)}%</span>
                  </span>
                </summary>
                <ul className="grid grid-cols-1 divide-y border-t">
                  {project.tasks.map((task) => (
                    <li key={task.taskId ?? "none"} className="flex items-start gap-3 px-3 py-2.5 pl-10 text-sm">
                      <span className="min-w-0 flex-1">
                        {task.taskId ? (
                          <Link href={`/tasks/${task.taskId}`} className="block truncate hover:underline">
                            {task.title}
                          </Link>
                        ) : (
                          <span className="block truncate text-muted-foreground">{task.title}</span>
                        )}
                        {team && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {task.editors.map((e) => `${e.name} ${duration(e.seconds)}`).join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular">{duration(task.seconds)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </Panel>

      {team && (
        <Panel title="By editor">
          <ul className="grid grid-cols-1 gap-3">
            {editors.map((editor) => (
              <li key={editor.id} className="flex items-center gap-3">
                <UserAvatar name={editor.name} src={editor.avatarUrl} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{editor.name}</span>
                    <span className="font-medium tabular">{duration(editor.seconds)}</span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-foreground/10">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(editor.seconds / total) * 100}%` }} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
