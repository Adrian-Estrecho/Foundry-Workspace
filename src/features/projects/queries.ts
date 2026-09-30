import "server-only";
import { notFound } from "next/navigation";
import type { CurrentUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { one } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getEditorOptions } from "@/features/clients/queries";
import type { StatusBadge, StatusColor } from "@/features/statuses/constants";
import { getProjectStatuses, getTaskStatuses } from "@/features/statuses/queries";
import { getProjectTasks, getTaskFormOptions, type Person } from "@/features/tasks/queries";
import { PROJECT_STAGES, type ProjectStatus } from "./constants";

/**
 * Client names by id, through client_directory (editors can read the names
 * of their projects' clients, but not their contact details). Without ids,
 * every client the user can see.
 */
async function clientNames(ids?: string[]) {
  const unique = [...new Set(ids)];
  if (ids && unique.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const query = supabase.from("client_directory").select("id, company, contact_name");
  const { data } = await (ids ? query.in("id", unique) : query);
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

/** Everyone who has been in the workspace, so a list can load names alongside its rows. */
async function workspacePeople(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("profile:profiles!workspace_members_user_id_fkey(id, full_name, avatar_url)")
    .eq("workspace_id", workspaceId);
  return new Map(
    (data ?? []).flatMap(({ profile: p }) => (p ? [[p.id, { id: p.id, name: p.full_name, avatarUrl: p.avatar_url }] as const] : [])),
  );
}

type RawStatus = { id: string; name: string; color: string };

/** The project's status, for chips. Falls back to the stage if it can't be read. */
const toStatusBadge = (raw: RawStatus | RawStatus[] | null, stage: ProjectStatus): StatusBadge => {
  const status = one(raw);
  return status
    ? { id: status.id, name: status.name, color: status.color as StatusColor }
    : { id: stage, name: PROJECT_STAGES.find((s) => s.value === stage)?.label ?? stage, color: "grey" };
};

export type ProjectSummary = {
  id: string;
  name: string;
  /** The stage (Delivered closes a project). */
  status: ProjectStatus;
  /** The workspace's own status the project is in. */
  statusInfo: StatusBadge;
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
  // Names load alongside the projects rather than after them: one round trip, not two.
  const [{ data, error }, statuses, clients, team] = await Promise.all([
    supabase
      .from("projects")
      .select(
        `id, name, status, deadline, client_id, created_at, delivered_at,
         status_info:project_statuses!projects_status_id_fkey(id, name, color),
         project_editors(editor_id),
         tasks(status, due_date)`,
      )
      .order("created_at", { ascending: false }),
    getProjectStatuses(),
    clientNames(),
    workspacePeople(user.workspace.id),
  ]);
  if (error) throw error;

  const projects: ProjectSummary[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    statusInfo: toStatusBadge(p.status_info, p.status),
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

  return { projects, statuses, today };
}

/**
 * Clients to pick from when creating a project from the Projects page. People
 * who manage projects but not clients only get names (the client directory).
 */
export async function getClientChoices(user: CurrentUser) {
  const supabase = await createClient();
  if (!user.permissions.includes("clients.manage")) {
    const { data } = await supabase.from("client_directory").select("id, company, contact_name");
    return (data ?? [])
      .flatMap((c) => (c.id && c.contact_name ? [{ id: c.id, name: c.company?.trim() || c.contact_name, driveFolderUrl: null, deadline: null }] : []))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
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
  const admin = user.permissions.includes("tasks.manage");

  const { data: project } = await supabase
    .from("projects")
    .select(
      `*,
       creator:profiles!projects_created_by_fkey(full_name),
       status_info:project_statuses!projects_status_id_fkey(id, name, color),
       project_editors(editor_id)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const teamIds = project.project_editors.map((pe) => pe.editor_id);
  const [tasks, clients, time, taskOptions, editorOptions, members, activeRows, taskStatuses, projectStatuses] = await Promise.all([
    getProjectTasks(id),
    clientNames([project.client_id]),
    supabase.rpc("project_time", { p_project_id: id }),
    admin ? getTaskFormOptions() : Promise.resolve(null),
    admin ? getEditorOptions() : Promise.resolve([]),
    people(teamIds),
    // Whether teammates are still active is for people who manage the work.
    admin ? supabase.from("editors").select("id, is_active").in("id", teamIds) : Promise.resolve({ data: [] }),
    getTaskStatuses(),
    getProjectStatuses(),
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
    statusInfo: toStatusBadge(project.status_info, project.status),
    projectStatuses,
    taskStatuses,
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
