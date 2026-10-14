import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { MyTasks } from "@/features/tasks/components/my-tasks";
import { taskAccess } from "@/features/tasks/access";
import { MY_TASK_VIEWS } from "@/features/tasks/constants";
import { parseTaskFilters } from "@/features/tasks/filters";
import { getMyTasks } from "@/features/tasks/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "My Tasks" };

export default async function MyTasksPage(props: PageProps<"/my-tasks">) {
  const user = await requireUser();
  // Admins manage everyone's work from Tasks.
  if (user.role === "admin") redirect("/tasks");

  // The Tasks page's filters, minus the editor (they're all theirs) and By Editor.
  const parsed = parseTaskFilters(await props.searchParams);
  const filters = { ...parsed, editor: null, view: MY_TASK_VIEWS.includes(parsed.view) ? parsed.view : "board" };
  const { tasks, options, statuses, today, month, counts } = await getMyTasks(user, filters);

  return (
    <>
      <RealtimeRefresh channel="my-tasks" tables="tasks,subtasks,task_comments,task_attachments" />
      <MyTasks
        access={{ ...taskAccess(user), manage: false }}
        tasks={tasks}
        filters={filters}
        options={options}
        statuses={statuses}
        today={today}
        month={month}
        counts={counts}
      />
    </>
  );
}
