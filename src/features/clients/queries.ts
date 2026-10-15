import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PORTAL_TOKEN } from "@/features/portal/constants";
import { workspaceLogoUrl } from "@/features/workspaces/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { EditorOption } from "@/features/projects/components/project-form-dialog";
import { one } from "@/lib/utils";
import type { Database, Enums } from "@/types/database";
import { findLinks, linkKind, type LinkKind } from "./links";

export type PipelineClient = {
  id: string;
  column: Enums<"client_stage">;
  position: number;
  name: string;
  contactName: string;
  email: string | null;
  projectType: string | null;
  budgetRange: string | null;
  deadline: string | null;
  stageChangedAt: string;
  depositStatus: Enums<"payment_status">;
  finalStatus: Enums<"payment_status">;
  driveFolderUrl: string | null;
  fromIntake: boolean;
  checklist: { done: number; total: number } | null;
  projectCount: number;
};

const displayName = (company: string | null, contact: string) => company?.trim() || contact;

/** Active, approved editors, for assigning to projects. */
export async function getEditorOptions(): Promise<EditorOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("editors")
    .select("id, profile:profiles!editors_id_fkey(full_name, avatar_url), member:workspace_members!editors_member_fkey!inner(status)")
    .eq("is_active", true)
    .eq("member.status", "active");
  return (data ?? [])
    .map((e) => ({ id: e.id, name: e.profile?.full_name ?? "Editor", avatarUrl: e.profile?.avatar_url ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPipeline() {
  const supabase = await createClient();
  const [{ data, error }, editors] = await Promise.all([
    supabase
      .from("clients")
      .select(
        `id, stage, position, contact_name, company, email, project_type, budget_range, deadline,
         stage_changed_at, deposit_status, final_status, drive_folder_url, lead_id,
         checklist:client_checklist_items(is_done), projects(id)`,
      )
      .order("position"),
    getEditorOptions(),
  ]);
  if (error) throw error;

  const clients: PipelineClient[] = (data ?? []).map((c) => ({
    id: c.id,
    column: c.stage,
    position: c.position,
    name: displayName(c.company, c.contact_name),
    contactName: c.contact_name,
    email: c.email,
    projectType: c.project_type,
    budgetRange: c.budget_range,
    deadline: c.deadline,
    stageChangedAt: c.stage_changed_at,
    depositStatus: c.deposit_status,
    finalStatus: c.final_status,
    driveFolderUrl: c.drive_folder_url,
    fromIntake: c.lead_id !== null,
    checklist: c.checklist.length
      ? { done: c.checklist.filter((i) => i.is_done).length, total: c.checklist.length }
      : null,
    projectCount: c.projects.length,
  }));

  return { clients, editors };
}

export async function getClientDetail(id: string) {
  const supabase = await createClient();
  const [{ data: client }, { data: activity }, editors] = await Promise.all([
    supabase
      .from("clients")
      .select(
        `*,
         lead:leads(*),
         checklist:client_checklist_items(*, done_by_profile:profiles(full_name)),
         projects(id, name, status, deadline, created_at,
           status_info:project_statuses!projects_status_id_fkey(name, color),
           project_editors(editor:editors(id, profile:profiles!editors_id_fkey(full_name, avatar_url))))`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("activity_log")
      .select("id, summary, created_at, actor:profiles(full_name, avatar_url)")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
    getEditorOptions(),
  ]);
  if (!client) notFound();

  // Contract PDFs are private: hand out a short-lived link.
  let contractUrl: string | null = null;
  if (client.contract_path) {
    const { data } = await supabase.storage.from("contracts").createSignedUrl(client.contract_path, 60 * 60);
    contractUrl = data?.signedUrl ?? null;
  }

  const projects = [...client.projects].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const assigned = new Map<string, { id: string; name: string; avatarUrl: string | null; projects: string[] }>();
  for (const project of projects) {
    for (const { editor } of project.project_editors) {
      if (!editor) continue;
      const entry = assigned.get(editor.id) ?? {
        id: editor.id,
        name: editor.profile?.full_name ?? "Editor",
        avatarUrl: editor.profile?.avatar_url ?? null,
        projects: [],
      };
      entry.projects.push(project.name);
      assigned.set(editor.id, entry);
    }
  }

  return {
    client: { ...client, name: displayName(client.company, client.contact_name) },
    checklist: [...client.checklist].sort((a, b) => a.position - b.position),
    projects,
    assignedEditors: [...assigned.values()],
    activity: activity ?? [],
    contractUrl,
    editors,
    renderedAt: Date.now(),
  };
}

export type ClientLink = {
  url: string;
  kind: LinkKind;
  /** What it belongs to: "Client folder", a project or a task. */
  title: string;
  /** Where it was found, e.g. "Review link", "Edited video v2", "Comment by Chris". */
  source: string;
  /** The project or task in ReEdit. */
  href: string | null;
  /** The project of a task's link. */
  projectName: string | null;
};

export type LinkDirectoryClient = {
  id: string;
  name: string;
  /** Not shown on the links portal. */
  stage: Enums<"client_stage"> | null;
  projectCount: number;
  links: ClientLink[];
};

const PAGE = 1000; // PostgREST's max_rows

/** Every row of a query, past the per-request cap. The query needs a stable order. */
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return rows;
  }
}

/** Rows whose `column` might hold a Frame.io or Drive link. findLinks and linkKind have the final say. */
const mightLink = (column: string) => ["frame.io", "f.io/", "drive.google.com"].map((host) => `${column}.ilike.*${host}*`).join(",");

/** A link field on a client or project: http(s) only, and its own kind when it isn't the expected one. */
const fieldKind = (url: string | null, expected: LinkKind): LinkKind | null =>
  url && /^https?:\/\//i.test(url) ? (linkKind(url) ?? expected) : null;

type FoundLink = ClientLink & {
  /** 0 the client, 1 a project, 2 a task. */
  tier: number;
  /** The project or task it belongs to, kept together and newest first. */
  group: string;
  groupAt: string;
  /** Within a group: edited videos, then links, the description, comments. */
  rank: number;
  at: string;
};

/**
 * Every client's Frame.io and Drive links: the client's Drive folder, each
 * project's folder and review link, and on the projects' tasks the edited
 * videos, links, descriptions and comments. A link a client has in several
 * places shows once, from the first of those.
 *
 * Every query names the workspace, because the links portal reads with the
 * service role (no RLS); signed in, RLS scopes it as well. `shared` (the
 * portal) leaves out who wrote a comment and the ways into ReEdit.
 */
export async function getClientLinks(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  { shared = false }: { shared?: boolean } = {},
): Promise<LinkDirectoryClient[]> {
  const [{ data: clients, error }, attachments, described, comments] = await Promise.all([
    supabase
      .from("clients")
      .select("id, company, contact_name, stage, drive_folder_url, projects(id, name, drive_folder_url, frameio_url, created_at)")
      .eq("workspace_id", workspaceId),
    allRows((from, to) =>
      supabase
        .from("task_attachments")
        .select("url, label, version, created_at, task:tasks!inner(id, title, project_id, created_at)")
        .eq("workspace_id", workspaceId)
        .eq("kind", "link")
        .or(mightLink("url"))
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      supabase
        .from("tasks")
        .select("id, title, project_id, description, created_at")
        .eq("workspace_id", workspaceId)
        .not("project_id", "is", null)
        .or(mightLink("description"))
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      supabase
        .from("task_comments")
        .select("body, created_at, clickup_author, author:profiles(full_name), task:tasks!inner(id, title, project_id, created_at)")
        .eq("workspace_id", workspaceId)
        .or(mightLink("body"))
        .order("id")
        .range(from, to),
    ),
  ]);
  if (error) throw error;

  const projects = new Map<string, { clientId: string; name: string }>();
  const found = new Map<string, Map<string, FoundLink>>();
  const add = (clientId: string, link: FoundLink) => {
    const links = found.get(clientId) ?? new Map<string, FoundLink>();
    found.set(clientId, links);
    const key = link.url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const existing = links.get(key);
    if (!existing || link.tier < existing.tier || (link.tier === existing.tier && link.rank < existing.rank)) links.set(key, link);
  };

  for (const client of clients ?? []) {
    const kind = fieldKind(client.drive_folder_url, "drive");
    if (kind) {
      add(client.id, {
        url: client.drive_folder_url!,
        kind,
        title: "Client folder",
        source: "On the client",
        href: null,
        projectName: null,
        tier: 0,
        group: client.id,
        groupAt: "",
        rank: 0,
        at: "",
      });
    }
    for (const project of client.projects) {
      projects.set(project.id, { clientId: client.id, name: project.name });
      const base = { title: project.name, href: `/projects/${project.id}`, projectName: project.name };
      const order = { tier: 1, group: project.id, groupAt: project.created_at, at: project.created_at };
      const folder = fieldKind(project.drive_folder_url, "drive");
      if (folder) add(client.id, { ...base, ...order, url: project.drive_folder_url!, kind: folder, source: "Project folder", rank: 0 });
      const review = fieldKind(project.frameio_url, "frameio");
      if (review) add(client.id, { ...base, ...order, url: project.frameio_url!, kind: review, source: "Review link", rank: 1 });
    }
  }

  type TaskRef = { id: string; title: string; project_id: string | null; created_at: string };
  const addForTask = (task: TaskRef | null, url: string, link: { source: string; rank: number; at: string; href?: string }) => {
    const project = task?.project_id ? projects.get(task.project_id) : undefined;
    const kind = linkKind(url);
    if (!task || !project || !kind) return;
    add(project.clientId, {
      url,
      kind,
      title: task.title,
      source: link.source,
      href: link.href ?? `/tasks/${task.id}`,
      projectName: project.name,
      tier: 2,
      group: task.id,
      groupAt: "",
      rank: link.rank,
      at: link.at,
    });
  };

  for (const a of attachments) {
    if (!a.url) continue;
    const source = a.version !== null ? `Edited video v${a.version}` : a.label?.trim() || "Link";
    addForTask(a.task, a.url, { source, rank: a.version !== null ? 0 : 1, at: a.created_at });
  }
  for (const task of described) {
    for (const url of findLinks(task.description)) addForTask(task, url, { source: "In the description", rank: 2, at: task.created_at });
  }
  for (const c of comments) {
    const author = shared ? null : (c.clickup_author ?? c.author?.full_name);
    for (const url of findLinks(c.body)) {
      addForTask(c.task, url, {
        source: author ? `Comment by ${author}` : "In a comment",
        rank: 3,
        at: c.created_at,
        href: c.task ? `/tasks/${c.task.id}#comments` : undefined,
      });
    }
  }

  return (clients ?? [])
    .map((client) => {
      const links = [...(found.get(client.id)?.values() ?? [])];
      // A task sorts by its newest link.
      const newest = new Map<string, string>();
      for (const link of links) if (link.tier === 2 && link.at > (newest.get(link.group) ?? "")) newest.set(link.group, link.at);
      for (const link of links) if (link.tier === 2) link.groupAt = newest.get(link.group)!;
      links.sort(
        (a, b) =>
          a.tier - b.tier ||
          b.groupAt.localeCompare(a.groupAt) ||
          a.group.localeCompare(b.group) ||
          a.rank - b.rank ||
          b.at.localeCompare(a.at),
      );
      return {
        id: client.id,
        name: displayName(client.company, client.contact_name),
        stage: shared ? null : client.stage,
        projectCount: client.projects.length,
        links: links.map(({ url, kind, title, source, href, projectName }) => ({ url, kind, title, source, href: shared ? null : href, projectName })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The workspace's links portal link, for Clients → Links. */
export async function getLinkPortalSettings(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("link_portals").select("token, enabled, last_viewed_at").eq("workspace_id", workspaceId).maybeSingle();
  return {
    portal: data ? { token: data.token, enabled: data.enabled, lastViewedAt: data.last_viewed_at } : null,
    renderedAt: Date.now(),
  };
}

/**
 * The links portal behind a private link (no login): the workspace's name
 * and brand, and each client that has links, with those links and nothing
 * else of the team's.
 */
export const getLinkPortal = cache(async (token: string) => {
  if (!PORTAL_TOKEN.test(token)) return null;
  const admin = createAdminClient();
  const { data: portal } = await admin
    .from("link_portals")
    .select("workspace_id, enabled, workspace:workspaces(name, default_accent, logo_path)")
    .eq("token", token)
    .maybeSingle();
  const workspace = one(portal?.workspace);
  if (!portal?.enabled || !workspace) return null;

  const clients = await getClientLinks(admin, portal.workspace_id, { shared: true });
  return {
    workspace: { name: workspace.name, accent: workspace.default_accent, logoUrl: workspaceLogoUrl(workspace.logo_path) },
    clients: clients.filter((client) => client.links.length > 0),
  };
});
