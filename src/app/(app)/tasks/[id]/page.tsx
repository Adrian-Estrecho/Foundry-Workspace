import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Clock3Icon, GraduationCapIcon, RotateCcwIcon } from "lucide-react";
import { HistoryPanel } from "@/components/shared/history-panel";
import { EmptyState, Panel } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { AttachmentsPanel } from "@/features/tasks/components/detail/attachments-panel";
import { CommentsPanel } from "@/features/tasks/components/detail/comments-panel";
import { DetailsPanel } from "@/features/tasks/components/detail/details-panel";
import { ReviewPanel } from "@/features/tasks/components/detail/review-panel";
import { SubtasksPanel } from "@/features/tasks/components/detail/subtasks-panel";
import { TaskHeader } from "@/features/tasks/components/detail/task-header";
import { TaskWorkspace } from "@/features/tasks/components/task-workspace";
import { getTaskDetail } from "@/features/tasks/queries";
import { requireUser } from "@/lib/auth";
import { formatDuration } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(props: PageProps<"/tasks/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!UUID.test(id)) return { title: "Task" };
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Task" };
}

export default async function TaskPage(props: PageProps<"/tasks/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();

  const data = await getTaskDetail(id, user);
  const { task, assignee, project, client, renderedAt } = data;
  const isAdmin = user.role === "admin";
  const isAssignee = assignee?.id === user.id;

  // Editors hand in their trial task from the onboarding page.
  if (task.is_trial && !isAdmin) redirect("/onboarding");

  const draft = {
    id: task.id,
    title: task.title,
    description: task.description,
    projectId: task.project_id,
    assigneeId: task.assignee_id,
    dueDate: task.due_date,
    priority: task.priority,
    status: task.status,
    statusId: data.statusInfo.id,
  };
  const totalSeconds = data.time.reduce((sum, row) => sum + row.seconds, 0);
  const latestFeedback = [...data.comments].reverse().find((c) => c.author?.isAdmin);

  return (
    <TaskWorkspace isAdmin={isAdmin} today={data.today} options={data.options} statuses={data.statuses}>
      <RealtimeRefresh channel={`task-${id}`} tables="tasks,subtasks,task_comments,task_attachments" />
      <TaskHeader
        task={{ ...draft, isTrial: task.is_trial, statusInfo: data.statusInfo }}
        canWork={isAssignee}
        context={
          task.is_trial ? (
            <span className="inline-flex items-center gap-1.5">
              <GraduationCapIcon className="size-4 text-primary" /> Trial task
              {assignee && (
                <>
                  {" · "}
                  <Link href={`/editors/${assignee.id}#trial`} className="hover:text-foreground">
                    {assignee.name}&apos;s onboarding
                  </Link>
                </>
              )}
            </span>
          ) : project ? (
            <>
              {client &&
                (isAdmin ? (
                  <Link href={`/clients/${client.id}`} className="hover:text-foreground">
                    {client.name}
                  </Link>
                ) : (
                  client.name
                ))}
              {client && " · "}
              <Link href={`/projects/${project.id}`} className="hover:text-foreground">
                {project.name}
              </Link>
            </>
          ) : (
            "Internal task"
          )
        }
      />

      {task.status === "revisions" && isAssignee && (
        <div className="mb-5 flex items-start gap-3 rounded-xl bg-danger/8 p-4 ring-1 ring-danger/25">
          <RotateCcwIcon className="mt-0.5 size-5 shrink-0 text-danger" />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-danger">Revisions requested{task.revision_count > 1 ? ` (round ${task.revision_count})` : ""}</p>
            {latestFeedback ? (
              <p className="mt-1 break-words whitespace-pre-line">{latestFeedback.body}</p>
            ) : (
              <p className="mt-1 text-muted-foreground">See the comments below for what to change.</p>
            )}
            <p className="mt-2 text-muted-foreground">Make the changes, then Send for review again.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="grid grid-cols-1 content-start gap-5 xl:col-span-8">
          {isAdmin && task.status === "for_review" && <ReviewPanel taskId={task.id} editorName={assignee?.name ?? null} />}

          <Panel title="Description">
            {task.description ? (
              <p className="text-sm leading-relaxed break-words whitespace-pre-line">{task.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{isAdmin ? "No description yet. Use Edit to add a brief." : "No description."}</p>
            )}
          </Panel>

          <SubtasksPanel
            taskId={task.id}
            subtasks={data.subtasks}
            canEdit={isAdmin || (isAssignee && task.status !== "done")}
          />
          <AttachmentsPanel
            taskId={task.id}
            attachments={data.attachments}
            canAdd={isAdmin || isAssignee}
            currentUserId={user.id}
            isAdmin={isAdmin}
            renderedAt={renderedAt}
          />
          <CommentsPanel
            taskId={task.id}
            comments={data.comments}
            people={data.people}
            currentUserId={user.id}
            isAdmin={isAdmin}
            canComment={isAdmin || isAssignee}
            renderedAt={renderedAt}
          />
        </div>

        <div className="grid grid-cols-1 content-start gap-5 xl:col-span-4">
          <DetailsPanel
            task={{ ...draft, statusInfo: data.statusInfo }}
            assignee={assignee}
            assigneeActive={data.assigneeActive}
            project={project ? { id: project.id, name: project.name } : null}
            revisionCount={task.revision_count}
            progress={task.progress_pct}
            canUpdateProgress={isAdmin || isAssignee}
            createdAt={task.created_at}
            creatorName={data.creatorName}
            completedAt={task.completed_at}
          />

          <Panel title="Time logged" description={totalSeconds > 0 ? `${formatDuration(totalSeconds)} in total` : undefined}>
            {data.time.length === 0 ? (
              <EmptyState icon={Clock3Icon} title="No time logged yet" description="Time shows here when editors work on this task." />
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {data.time.map((row) => (
                  <li key={row.editorId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{row.name}</span>
                    <span className="font-medium tabular">{formatDuration(row.seconds)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {isAdmin && <HistoryPanel entries={data.activity} renderedAt={renderedAt} />}
        </div>
      </div>
    </TaskWorkspace>
  );
}
