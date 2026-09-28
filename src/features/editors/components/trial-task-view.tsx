import { CalendarIcon, LinkIcon, MessageSquareIcon } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { dueLabel, timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

export type TrialTask = {
  id: string;
  title: string;
  description: string | null;
  status: Enums<"task_status">;
  due_date: string | null;
  attachments: { id: string; kind: string; url: string | null; label: string | null; created_at: string }[];
  comments: { id: string; body: string; created_at: string; author: { full_name: string; avatar_url: string | null } | null }[];
};

const STATUS: Record<Enums<"task_status">, { label: string; className: string }> = {
  todo: { label: "To do", className: "bg-muted text-muted-foreground ring-border" },
  in_progress: { label: "In progress", className: "bg-status-online/12 text-status-online ring-status-online/25" },
  for_review: { label: "In review", className: "bg-warning/12 text-warning ring-warning/25" },
  revisions: { label: "Changes requested", className: "bg-danger/10 text-danger ring-danger/25" },
  done: { label: "Approved", className: "bg-success/12 text-success ring-success/25" },
};

export function TrialStatusChip({ status }: { status: Enums<"task_status"> }) {
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1", STATUS[status].className)}>
      {STATUS[status].label}
    </span>
  );
}

/**
 * The trial task brief plus its thread: submitted links and feedback, oldest
 * first. Shared by the editor's onboarding page and the admin's editor profile.
 */
export function TrialTaskView({ task, today, renderedAt }: { task: TrialTask; today: string; renderedAt: number }) {
  const thread = [
    ...task.attachments
      .filter((a) => a.kind === "link" && a.url)
      .map((a) => ({ type: "link" as const, id: a.id, at: a.created_at, url: a.url!, label: a.label })),
    ...task.comments.map((c) => ({ type: "comment" as const, id: c.id, at: c.created_at, body: c.body, author: c.author })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="rounded-2xl bg-surface p-4 ring-1 ring-border">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 font-medium">{task.title}</p>
          <TrialStatusChip status={task.status} />
        </div>
        {task.due_date && task.status !== "done" && (
          <p className={cn("mt-1 flex items-center gap-1.5 text-xs", task.due_date < today ? "text-danger" : "text-muted-foreground")}>
            <CalendarIcon className="size-3.5" /> {dueLabel(task.due_date, today)}
          </p>
        )}
        {task.description && <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">{task.description}</p>}
      </div>

      {thread.length > 0 && (
        <ol className="grid grid-cols-1 gap-2">
          {thread.map((item) =>
            item.type === "link" ? (
              <li key={item.id} className="flex items-center gap-3 px-1 text-sm">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/25">
                  <LinkIcon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <a href={item.url} target="_blank" rel="noreferrer" className="block truncate font-medium hover:text-primary">
                    {item.url.replace(/^https?:\/\//, "")}
                  </a>
                  <span className="block text-xs text-muted-foreground">
                    {item.label ?? "Link"} · {timeAgo(item.at, renderedAt)}
                  </span>
                </span>
              </li>
            ) : (
              <li key={item.id} className="flex items-start gap-3 px-1 text-sm">
                {item.author ? (
                  <UserAvatar name={item.author.full_name} src={item.author.avatar_url} className="size-7" />
                ) : (
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted">
                    <MessageSquareIcon className="size-3.5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">
                    {item.author?.full_name ?? "Someone"} · {timeAgo(item.at, renderedAt)}
                  </span>
                  <span className="mt-0.5 block rounded-xl bg-surface px-3 py-2 whitespace-pre-line ring-1 ring-border">{item.body}</span>
                </span>
              </li>
            ),
          )}
        </ol>
      )}
    </div>
  );
}
