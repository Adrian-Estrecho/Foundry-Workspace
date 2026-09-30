import "server-only";
import { cache } from "react";
import type { ProjectStatusDef } from "@/features/projects/constants";
import type { TaskStatusDef } from "@/features/tasks/constants";
import { createClient } from "@/lib/supabase/server";
import type { StatusColor, StatusDef, StatusKind } from "./constants";

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

/** The workspace's task statuses in the order admins arranged them (the board's columns). */
export const getTaskStatuses = cache(async (): Promise<TaskStatusDef[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_statuses")
    .select("id, name, color, stage, position")
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
    .order("position")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map(toDef);
});

/** One kind's statuses with how much is in each, for the status editor (admins see everything). */
export async function getStatusesInUse(kind: StatusKind): Promise<StatusInUse<StatusDef>[]> {
  const supabase = await createClient();
  if (kind === "task") {
    const { data, error } = await supabase
      .from("task_statuses")
      .select("id, name, color, stage, position, tasks(count)")
      .order("position")
      .order("created_at");
    if (error) throw error;
    return (data ?? []).map((row) => ({ ...toDef(row), count: row.tasks[0]?.count ?? 0 }));
  }
  const { data, error } = await supabase
    .from("project_statuses")
    .select("id, name, color, stage, position, projects(count)")
    .order("position")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...toDef(row), count: row.projects[0]?.count ?? 0 }));
}
