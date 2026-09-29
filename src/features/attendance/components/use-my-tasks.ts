"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { Enums } from "@/types/database";

export type PickableTask = {
  id: string;
  title: string;
  projectName: string | null;
  dueDate: string | null;
  status: Enums<"task_status">;
  progress: number;
};

/**
 * The signed-in editor's open tasks (RLS returns only theirs, in the current
 * workspace). Loaded when `enabled` turns on, e.g. when a picker opens, and
 * again each time it does, so new assignments show up.
 */
export function useMyOpenTasks(userId: string, enabled: boolean) {
  const [tasks, setTasks] = React.useState<PickableTask[] | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void createClient()
      .from("tasks")
      .select("id, title, status, due_date, progress_pct, project:projects(name)")
      .eq("assignee_id", userId)
      .eq("is_trial", false)
      .neq("status", "done")
      .order("due_date", { nullsFirst: false })
      .limit(200)
      .then(({ data }) => {
        if (cancelled) return;
        setTasks(
          (data ?? []).map((t) => ({
            id: t.id,
            title: t.title,
            projectName: t.project?.name ?? null,
            dueDate: t.due_date,
            status: t.status,
            progress: t.progress_pct,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  return tasks;
}
