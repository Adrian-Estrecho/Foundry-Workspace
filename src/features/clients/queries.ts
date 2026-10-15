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
import type { LinkKind } from "./links";

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
  /** "Main folder", or the project the Frame.io link is on. */
  title: string;
  /** The project in ReEdit. */
  href: string | null;
};

export type LinkDirectoryClient = {
  id: string;
  name: string;
  /** Not shown on the links portal. */
  stage: Enums<"client_stage"> | null;
  links: ClientLink[];
};

/** http(s) only: the database accepts any text, `javascript:` included. */
const isWebUrl = (url: string | null): url is string => !!url && /^https?:\/\//i.test(url);

/**
 * Each client's main Drive folder and their projects' Frame.io links, newest
 * project first.
 *
 * The query names the workspace, because the links portal reads with the
 * service role (no RLS); signed in, RLS scopes it as well. `shared` (the
 * portal) leaves out stages and the ways into ReEdit.
 */
export async function getClientLinks(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  { shared = false }: { shared?: boolean } = {},
): Promise<LinkDirectoryClient[]> {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, company, contact_name, stage, drive_folder_url, projects(id, name, frameio_url, created_at)")
    .eq("workspace_id", workspaceId);
  if (error) throw error;

  return (clients ?? [])
    .map((client) => {
      const links: ClientLink[] = [];
      if (isWebUrl(client.drive_folder_url)) {
        links.push({ url: client.drive_folder_url, kind: "drive", title: "Main folder", href: null });
      }
      const seen = new Set<string>();
      for (const project of [...client.projects].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
        if (!isWebUrl(project.frameio_url) || seen.has(project.frameio_url)) continue;
        seen.add(project.frameio_url);
        links.push({ url: project.frameio_url, kind: "frameio", title: project.name, href: shared ? null : `/projects/${project.id}` });
      }
      return { id: client.id, name: displayName(client.company, client.contact_name), stage: shared ? null : client.stage, links };
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
