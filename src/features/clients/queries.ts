import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EditorOption } from "@/features/projects/components/project-form-dialog";
import type { Enums } from "@/types/database";

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

/** Active editors, for assigning to projects. */
export async function getEditorOptions(): Promise<EditorOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("editors")
    .select("id, profile:profiles!editors_id_fkey(full_name, avatar_url)")
    .eq("is_active", true);
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
