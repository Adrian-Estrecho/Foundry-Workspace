import type { Metadata } from "next";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { parseTaskFilters } from "@/features/tasks/filters";
import { getTasksPage } from "@/features/tasks/queries";
import { TaskViews } from "@/features/tasks/components/task-views";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage(props: PageProps<"/tasks">) {
  const user = await requireAdmin();
  const filters = parseTaskFilters(await props.searchParams);
  const { tasks, options, statuses, today, month, counts } = await getTasksPage(user, filters);

  return (
    <>
      <RealtimeRefresh channel="tasks" tables="tasks,subtasks,task_comments,task_attachments" />
      <TaskViews
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
