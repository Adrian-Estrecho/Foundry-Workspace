import "server-only";
import { cache } from "react";
import type { ProjectStatusDef } from "@/features/projects/constants";
import type { TaskStatusDef } from "@/features/tasks/constants";
import { createClient } from "@/lib/supabase/server";
import type { StatusColor } from "./constants";

/** A status in the settings list, with how many tasks or projects are in it. */
export type StatusInUse<T> = T & { count: number };

type Row<Stage> = { id: string; name: string; color: string; stage: Stage; position: number };

const toDef = <Stage extends string>(row: Row<Stage>) => ({
  id: row.id,
  name: row.name,
  color: row.color as StatusColor,
  stage: row.stage,
  position: row.position,
});

/** The workspace's task statuses in board order: by stage, then as arranged. */
export const getTaskStatuses = cache(async (): Promise<TaskStatusDef[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_statuses")
    .select("id, name, color, stage, position")
    .order("stage")
    .order("position")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map(toDef);
});

export const getProjectStatuses = cache(async (): Promise<ProjectStatusDef[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_statuses")
    .select("id, name, color, stage, position")
    .order("stage")
    .order("position")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map(toDef);
});

/** Both lists with usage counts, for the Workspace page (admins see every task). */
export async function getStatusSettings() {
  const supabase = await createClient();
  const [tasks, projects] = await Promise.all([
    supabase
      .from("task_statuses")
      .select("id, name, color, stage, position, tasks(count)")
      .order("stage")
      .order("position")
      .order("created_at"),
    supabase
      .from("project_statuses")
      .select("id, name, color, stage, position, projects(count)")
      .order("stage")
      .order("position")
      .order("created_at"),
  ]);
  if (tasks.error) throw tasks.error;
  if (projects.error) throw projects.error;

  return {
    tasks: (tasks.data ?? []).map((row): StatusInUse<TaskStatusDef> => ({ ...toDef(row), count: row.tasks[0]?.count ?? 0 })),
    projects: (projects.data ?? []).map(
      (row): StatusInUse<ProjectStatusDef> => ({ ...toDef(row), count: row.projects[0]?.count ?? 0 }),
    ),
  };
}
