import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Every SOP (drafts too) with how many of the workspace's approved editors
 * have read it, for people who manage SOPs.
 */
export async function getSopAdminList() {
  const supabase = await createClient();
  const [{ data: sops }, { data: editors }] = await Promise.all([
    supabase
      .from("sops")
      .select("id, title, category, is_required, is_published, updated_at, acknowledgments:sop_acknowledgments(editor_id)")
      .order("is_required", { ascending: false })
      .order("title"),
    supabase
      .from("editors")
      .select("id, member:workspace_members!editors_member_fkey!inner(status)")
      .eq("is_active", true)
      .eq("member.status", "active"),
  ]);
  const team = new Set((editors ?? []).map((e) => e.id));
  return {
    sops: (sops ?? []).map((sop) => ({
      id: sop.id,
      title: sop.title,
      category: sop.category,
      required: sop.is_required,
      published: sop.is_published,
      updatedAt: sop.updated_at,
      readBy: sop.acknowledgments.filter((a) => team.has(a.editor_id)).length,
    })),
    teamSize: team.size,
    renderedAt: Date.now(),
  };
}

/** One SOP to edit. */
export async function getSopForEdit(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sops")
    .select("id, title, category, content, is_required, is_published, updated_at")
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Published SOPs, required ones first, with the editor's own read receipts. */
export async function getSopLibrary(user: CurrentUser) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sops")
    .select("id, title, category, content, is_required, acknowledgments:sop_acknowledgments(editor_id, acknowledged_at)")
    .eq("is_published", true)
    .order("is_required", { ascending: false })
    .order("title");

  // Their own read receipt (people who manage SOPs can read everyone's).
  const sops = (data ?? []).map((sop) => ({
    id: sop.id,
    title: sop.title,
    category: sop.category,
    content: sop.content,
    required: sop.is_required,
    acknowledgedAt: user.role === "editor" ? (sop.acknowledgments.find((a) => a.editor_id === user.id)?.acknowledged_at ?? null) : null,
  }));
  return { sops, renderedAt: Date.now() };
}
