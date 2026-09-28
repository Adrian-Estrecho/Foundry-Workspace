import "server-only";
import { notFound } from "next/navigation";
import type { CurrentUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getEditorOptions } from "@/features/clients/queries";
import { getProjectTasks, getTaskFormOptions, type Person } from "@/features/tasks/queries";
import type { ProjectStatus } from "./constants";

/**
 * Client names by id, through client_directory (editors can read the names
 * of their projects' clients, but not their contact details).
 */
async function clientNames(ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.from("client_directory").select("id, company, contact_name").in("id", unique);
  return new Map((data ?? []).filter((c) => c.id).map((c) => [c.id!, c.company?.trim() || c.contact_name || "Client"] as const));
}

/**
 * Names and avatars for project team members. Read from profiles: editors
 * can't read each other's editor records (rates live there), but every
 * signed-in user can see names.
 */
async function people(ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, Person>();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, { id: p.id, name: p.full_name, avatarUrl: p.avatar_url }] as const));
}

export type ProjectSummary = {
  id: string;
  name: string;
  status: ProjectStatus;
  deadline: string | null;
  client: { id: string; name: string };
  editors: Person[];
  tasks: { total: number; done: number; overdue: number; forReview: number };
  createdAt: string;
  deliveredAt: string | null;
};

/** Every project for admins; the projects they're on for editors (RLS). */
export async function getProjects(user: CurrentUser) {
  const supabase = await createClient();
  const today = todayIn(user.timezone);
  const { data, error } = await supabase
    .from("projects")
    .select(
      `id, name, status, deadline, client_id, created_at, delivered_at,
       project_editors(editor_id),
       tasks(status, due_date)`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const [clients, team] = await Promise.all([
    clientNames((data ?? []).map((p) => p.client_id)),
    people((data ?? []).flatMap((p) => p.project_editors.map((pe) => pe.editor_id))),
  ]);
  const projects: ProjectSummary[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    deadline: p.deadline,
    client: { id: p.client_id, name: clients.get(p.client_id) ?? "Client" },
    editors: p.project_editors
      .map((pe) => team.get(pe.editor_id))
      .filter((e): e is Person => Boolean(e))
      .sort((a, b) => a.name.localeCompare(b.name)),
    tasks: {
      total: p.tasks.length,
      done: p.tasks.filter((t) => t.status === "done").length,
      overdue: p.tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length,
      forReview: p.tasks.filter((t) => t.status === "for_review").length,
    },
    createdAt: p.created_at,
    deliveredAt: p.delivered_at,
  }));

  return { projects, today };
}

/** Clients to pick from when creating a project from the Projects page. */
export async function getClientChoices() {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, company, contact_name, stage, drive_folder_url, deadline");
  return (data ?? [])
    .map((c) => ({
      id: c.id,
      name: c.company?.trim() || c.contact_name,
      stage: c.stage,
      driveFolderUrl: c.drive_folder_url,
      deadline: c.deadline,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProjectDetail(id: string, user: CurrentUser) {
  const supabase = await createClient();
  const admin = user.role === "admin";

  const { data: project } = await supabase
    .from("projects")
    .select(
      `*,
       creator:profiles!projects_created_by_fkey(full_name),
       project_editors(editor_id)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const teamIds = project.project_editors.map((pe) => pe.editor_id);
  const [tasks, clients, time, taskOptions, editorOptions, members, activeRows] = await Promise.all([
    getProjectTasks(id),
    clientNames([project.client_id]),
    supabase.rpc("project_time", { p_project_id: id }),
    admin ? getTaskFormOptions() : Promise.resolve(null),
    admin ? getEditorOptions() : Promise.resolve([]),
    people(teamIds),
    // Whether teammates are still active is admin-only information.
    admin ? supabase.from("editors").select("id, is_active").in("id", teamIds) : Promise.resolve({ data: [] }),
  ]);

  // History: the project's own events plus its tasks' (most recent tasks first).
  const entityIds = [id, ...tasks.slice(0, 150).map((t) => t.id)];
  const { data: activity } = admin
    ? await supabase
        .from("activity_log")
        .select("id, summary, created_at, actor:profiles(full_name, avatar_url)")
        .in("entity_id", entityIds)
        .order("created_at", { ascending: false })
        .limit(12)
    : { data: [] };

  const inactive = new Set((activeRows.data ?? []).filter((e) => !e.is_active).map((e) => e.id));
  const team = teamIds
    .map((editorId) => members.get(editorId))
    .filter((e): e is Person => Boolean(e))
    .map((person) => ({ ...person, isActive: !inactive.has(person.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const names = new Map(team.map((e) => [e.id, e.name]));
  const unnamed = (time.data ?? []).map((row) => row.editor_id).filter((editorId) => !names.has(editorId));
  if (unnamed.length) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", unnamed);
    for (const profile of data ?? []) names.set(profile.id, profile.full_name);
  }

  return {
    project,
    client: { id: project.client_id, name: clients.get(project.client_id) ?? "Client" },
    creatorName: project.creator?.full_name ?? null,
    team,
    tasks,
    time: (time.data ?? [])
      .map((row) => ({ editorId: row.editor_id, name: names.get(row.editor_id) ?? "Editor", seconds: Number(row.seconds) }))
      .sort((a, b) => b.seconds - a.seconds),
    activity: activity ?? [],
    taskOptions,
    editorOptions,
    today: todayIn(user.timezone),
    renderedAt: Date.now(),
  };
}
