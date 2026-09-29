import "server-only";
import { cache } from "react";
import { workspaceLogoUrl } from "@/features/workspaces/constants";
import { todayIn } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/types/database";
import { PORTAL_TOKEN } from "./constants";

/**
 * A client's portal, read with the service role: the private link is the
 * only key, so every query here is scoped to that one client. Clients see
 * their projects and each task's title, status, priority, due date and
 * checklist progress, never internal notes, comments, files or who the
 * editor is.
 */

export type PortalTask = {
  id: string;
  title: string;
  status: Enums<"task_status">;
  priority: Enums<"task_priority">;
  dueDate: string | null;
  completedAt: string | null;
  updatedAt: string;
  projectId: string;
  projectName: string;
  subtasks: { done: number; total: number };
};

export type PortalProject = {
  id: string;
  name: string;
  status: Enums<"project_status">;
  deadline: string | null;
  deliveredAt: string | null;
  total: number;
  done: number;
};

export type PortalMessage = {
  id: string;
  body: string;
  fromClient: boolean;
  authorName: string;
  authorAvatar: string | null;
  createdAt: string;
};

export const getPortal = cache(async (token: string) => {
  if (!PORTAL_TOKEN.test(token)) return null;
  const admin = createAdminClient();

  const { data: portal } = await admin
    .from("client_portals")
    .select("client_id, workspace_id, enabled")
    .eq("token", token)
    .maybeSingle();
  if (!portal?.enabled) return null;

  const [{ data: client }, { data: workspace }, { data: owner }, { data: projects }, { data: thread }] = await Promise.all([
    admin.from("clients").select("id, company, contact_name").eq("id", portal.client_id).maybeSingle(),
    admin.from("workspaces").select("*").eq("id", portal.workspace_id).maybeSingle(),
    admin
      .from("workspace_members")
      .select("profile:profiles!workspace_members_user_id_fkey(timezone)")
      .eq("workspace_id", portal.workspace_id)
      .eq("role", "owner")
      .maybeSingle(),
    admin
      .from("projects")
      .select("id, name, status, deadline, delivered_at, created_at")
      .eq("client_id", portal.client_id)
      .order("created_at", { ascending: false }),
    admin
      .from("message_threads")
      .select("id, client_last_read_at")
      .eq("kind", "client")
      .eq("client_id", portal.client_id)
      .maybeSingle(),
  ]);
  if (!client || !workspace) return null;

  const projectIds = (projects ?? []).map((p) => p.id);
  const [{ data: tasks }, { data: messages }] = await Promise.all([
    projectIds.length
      ? admin
          .from("tasks")
          .select("id, title, status, priority, due_date, completed_at, updated_at, project_id, subtasks(is_done)")
          .in("project_id", projectIds)
          .eq("is_trial", false)
          .order("due_date", { nullsFirst: false })
          .limit(2000)
      : Promise.resolve({ data: [] }),
    thread
      ? admin
          .from("messages")
          .select("id, body, sender, created_at, author:profiles(full_name, avatar_url)")
          .eq("thread_id", thread.id)
          .order("created_at", { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] }),
  ]);

  const projectName = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const portalTasks: PortalTask[] = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.due_date,
    completedAt: t.completed_at,
    updatedAt: t.updated_at,
    projectId: t.project_id!,
    projectName: projectName.get(t.project_id!) ?? "Project",
    subtasks: { done: t.subtasks.filter((s) => s.is_done).length, total: t.subtasks.length },
  }));

  const clientName = client.company?.trim() || client.contact_name;
  const portalMessages: PortalMessage[] = (messages ?? []).reverse().map((m) => ({
    id: m.id,
    body: m.body,
    fromClient: m.sender === "client",
    authorName: m.sender === "client" ? client.contact_name : (m.author?.full_name ?? workspace.name),
    authorAvatar: m.sender === "client" ? null : (m.author?.avatar_url ?? null),
    createdAt: m.created_at,
  }));

  const lastReadAt = thread?.client_last_read_at ?? null;
  const timeZone = owner?.profile?.timezone ?? "UTC";

  return {
    token,
    workspace: { name: workspace.name, accent: workspace.default_accent, logoUrl: workspaceLogoUrl(workspace.logo_path) },
    client: { name: clientName, contactName: client.contact_name },
    projects: (projects ?? []).map<PortalProject>((p) => {
      const mine = portalTasks.filter((t) => t.projectId === p.id);
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        deadline: p.deadline,
        deliveredAt: p.delivered_at,
        total: mine.length,
        done: mine.filter((t) => t.status === "done").length,
      };
    }),
    tasks: portalTasks,
    messages: portalMessages,
    lastReadAt,
    unread: portalMessages.filter((m) => !m.fromClient && (!lastReadAt || m.createdAt > lastReadAt)).length,
    timeZone,
    today: todayIn(timeZone),
    renderedAt: Date.now(),
  };
});

export type Portal = NonNullable<Awaited<ReturnType<typeof getPortal>>>;
