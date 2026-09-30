import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { MyTasks } from "@/features/tasks/components/my-tasks";
import { taskAccess } from "@/features/tasks/access";
import { getMyTasks } from "@/features/tasks/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "My Tasks" };

export default async function MyTasksPage(props: PageProps<"/my-tasks">) {
  const user = await requireUser();
  // Admins manage everyone's work from Tasks.
  if (user.role === "admin") redirect("/tasks");

  const { view } = await props.searchParams;
  const { tasks, statuses, today } = await getMyTasks(user);

  return (
    <>
      <RealtimeRefresh channel="my-tasks" tables="tasks,subtasks,task_comments" />
      <MyTasks access={{ ...taskAccess(user), manage: false }} tasks={tasks} statuses={statuses} today={today} view={view === "board" ? "board" : "list"} />
    </>
  );
}
