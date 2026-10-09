import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GraduationCapIcon, RotateCcwIcon } from "lucide-react";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { AttachmentsPanel } from "@/features/tasks/components/detail/attachments-panel";
import { CommentsDrawer } from "@/features/tasks/components/detail/comments-drawer";
import { DescriptionPanel } from "@/features/tasks/components/detail/description-panel";
import { EditedVideoPanel } from "@/features/tasks/components/detail/edited-video-panel";
import { ReviewPanel } from "@/features/tasks/components/detail/review-panel";
import { SubtasksPanel } from "@/features/tasks/components/detail/subtasks-panel";
import { TaskDetailShell } from "@/features/tasks/components/detail/task-detail-shell";
import { TaskHeader } from "@/features/tasks/components/detail/task-header";
import { TaskProperties } from "@/features/tasks/components/detail/task-properties";
import { taskAccess } from "@/features/tasks/access";
import { TaskWorkspace } from "@/features/tasks/components/task-workspace";
import { getTaskDetail } from "@/features/tasks/queries";
import { can, requireUser } from "@/lib/auth";
import { clickupTaskUrl } from "@/lib/clickup";
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
  const access = taskAccess(user, { trial: task.is_trial });
  const isAssignee = assignee?.id === user.id;

  // Editors hand in their trial task from the onboarding page.
  if (task.is_trial && !access.manage) redirect("/onboarding");

  const clickupUrl = task.clickup_task_id ? clickupTaskUrl(task.clickup_task_id) : null;
  const synced = Boolean(clickupUrl);
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
    fromClickUp: synced,
  };
  const canAdd = access.manage || isAssignee;
  // The reviewer's note: the latest comment by someone other than the editor.
  const latestFeedback = [...data.comments].reverse().find((c) => (c.author ? c.author.id !== assignee?.id : c.fromClickUp));

  return (
    <TaskWorkspace access={access} today={data.today} options={data.options} statuses={data.statuses}>
      <RealtimeRefresh channel={`task-${id}`} tables="tasks,subtasks,task_comments,task_attachments" />
      <TaskDetailShell
        drawer={
          <CommentsDrawer
            taskId={task.id}
            comments={data.comments}
            people={data.people}
            currentUserId={user.id}
            isAdmin={user.role === "admin"}
            canComment={canAdd}
            synced={synced}
            history={data.showHistory ? data.activity : null}
            renderedAt={renderedAt}
          />
        }
      >
        <div className="mx-auto max-w-5xl">
          <TaskHeader
            task={{ ...draft, isTrial: task.is_trial, statusInfo: data.statusInfo }}
            canWork={isAssignee}
            clickupUrl={clickupUrl}
            commentCount={data.comments.length}
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
                    (can(user, "clients.manage") ? (
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

          <TaskProperties
            task={{
              id: task.id,
              title: task.title,
              status: task.status,
              statusInfo: data.statusInfo,
              dueDate: task.due_date,
              priority: task.priority,
              fromClickUp: synced,
            }}
            canWork={isAssignee}
            assignee={assignee}
            assigneeActive={data.assigneeActive}
            project={project ? { id: project.id, name: project.name } : null}
            revisionCount={task.revision_count}
            progress={task.progress_pct}
            canUpdateProgress={canAdd}
            time={data.time}
            createdAt={task.created_at}
            creatorName={data.creatorName}
            completedAt={task.completed_at}
          />

          <div className="mt-5 grid grid-cols-1 gap-5">
            {task.status === "revisions" && isAssignee && (
              <div className="flex items-start gap-3 rounded-xl bg-danger/8 p-4 ring-1 ring-danger/25">
                <RotateCcwIcon className="mt-0.5 size-5 shrink-0 text-danger" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-danger">Revisions requested{task.revision_count > 1 ? ` (round ${task.revision_count})` : ""}</p>
                  {latestFeedback ? (
                    <p className="mt-1 break-words whitespace-pre-line">{latestFeedback.body}</p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">See the comments for what to change.</p>
                  )}
                  <p className="mt-2 text-muted-foreground">Make the changes, send the new version below, then Send for review again.</p>
                </div>
              </div>
            )}

            {access.anyStatus && task.status === "for_review" && <ReviewPanel taskId={task.id} editorName={assignee?.name ?? null} />}

            <EditedVideoPanel
              taskId={task.id}
              videos={data.videos}
              canAdd={canAdd}
              prompt={isAssignee}
              currentUserId={user.id}
              canRemoveAny={access.manage}
              synced={synced}
              renderedAt={renderedAt}
            />

            <DescriptionPanel
              description={task.description}
              emptyText={access.manage ? "No description yet. Use Edit to add a brief." : "No description."}
            />

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <SubtasksPanel taskId={task.id} subtasks={data.subtasks} canEdit={access.manage || (isAssignee && task.status !== "done")} />
              <AttachmentsPanel
                taskId={task.id}
                attachments={data.attachments}
                canAdd={canAdd}
                currentUserId={user.id}
                canRemoveAny={access.manage}
                synced={synced}
                renderedAt={renderedAt}
              />
            </div>
          </div>
        </div>
      </TaskDetailShell>
    </TaskWorkspace>
  );
}
