import "server-only";
import { accessTitle } from "@/features/people/labels";
import { getPeople } from "@/features/people/queries";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/utils";
import { audienceOf, audienceSummary, canSee, groupOf, seesAllSops, type Reader } from "./audience";

export type SopCategory = { id: string; name: string };

/** The workspace's SOP categories, in their order. */
export async function getSopCategories(): Promise<SopCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sop_categories").select("id, name").order("position").order("name");
  if (error) throw error;
  return data ?? [];
}

/** The category's name on an SOP row (embedded as `category:sop_categories!sops_category_fkey(name)`). */
export const categoryName = (category: { name: string } | { name: string }[] | null) => one(category)?.name ?? "Other";

/** Everyone in the workspace, as the "Who can see it" picker lists them. */
export async function getSopReaders(user: CurrentUser): Promise<Reader[]> {
  const people = await getPeople(user);
  return people.map((person) => {
    const group = groupOf(person);
    return {
      id: person.id,
      name: person.name,
      avatarUrl: person.avatarUrl,
      // An editor without a title but with extra abilities would read as just "Editor" among the managers.
      title: !person.title && person.role === "editor" && group === "admins" ? "Editor with extra access" : accessTitle(person),
      group,
      seesAll: seesAllSops(person),
      onboarding: person.status === "onboarding",
    };
  });
}

/**
 * Every SOP (drafts too), who can see it, and how many of the approved
 * editors who can see it have read it, for people who manage SOPs.
 */
export async function getSopAdminList(user: CurrentUser) {
  const supabase = await createClient();
  const [{ data: sops }, { data: editors }, readers, categories] = await Promise.all([
    supabase
      .from("sops")
      .select(
        "id, title, category_id, category:sop_categories!sops_category_fkey(name), content, is_required, is_published, visible_to_admins, visible_to_editors, shared_with, updated_at, acknowledgments:sop_acknowledgments(editor_id)",
      )
      .order("is_required", { ascending: false })
      .order("title"),
    supabase
      .from("editors")
      .select("id, member:workspace_members!editors_member_fkey!inner(status)")
      .eq("is_active", true)
      .eq("member.status", "active"),
    getSopReaders(user),
    getSopCategories(),
  ]);
  const active = new Set((editors ?? []).map((e) => e.id));
  const team = readers.filter((reader) => active.has(reader.id));
  return {
    sops: (sops ?? []).map((sop) => {
      const audience = audienceOf(sop);
      // Only editors can mark an SOP as read: count the ones who can see it.
      const audienceTeam = new Set(team.filter((reader) => canSee(audience, reader)).map((reader) => reader.id));
      return {
        id: sop.id,
        title: sop.title,
        categoryId: sop.category_id,
        category: categoryName(sop.category),
        content: sop.content,
        required: sop.is_required,
        published: sop.is_published,
        updatedAt: sop.updated_at,
        audience: audienceSummary(audience, readers),
        everyone: audience.admins && audience.editors,
        readBy: sop.acknowledgments.filter((a) => audienceTeam.has(a.editor_id)).length,
        teamSize: audienceTeam.size,
      };
    }),
    categories,
    renderedAt: Date.now(),
  };
}

/** One SOP to edit. */
export async function getSopForEdit(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sops")
    .select("id, title, category_id, content, is_required, is_published, visible_to_admins, visible_to_editors, shared_with, updated_at")
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Published SOPs, required ones first, with the editor's own read receipts. */
export async function getSopLibrary(user: CurrentUser) {
  const supabase = await createClient();
  const [{ data }, categories] = await Promise.all([
    supabase
      .from("sops")
      .select(
        "id, title, category_id, category:sop_categories!sops_category_fkey(name), content, is_required, updated_at, acknowledgments:sop_acknowledgments(editor_id, acknowledged_at)",
      )
      .eq("is_published", true)
      .order("is_required", { ascending: false })
      .order("title"),
    getSopCategories(),
  ]);

  // Their own read receipt (people who manage SOPs can read everyone's).
  const sops = (data ?? []).map((sop) => ({
    id: sop.id,
    title: sop.title,
    categoryId: sop.category_id,
    category: categoryName(sop.category),
    content: sop.content,
    required: sop.is_required,
    updatedAt: sop.updated_at,
    acknowledgedAt: user.role === "editor" ? (sop.acknowledgments.find((a) => a.editor_id === user.id)?.acknowledged_at ?? null) : null,
  }));
  return { sops, categories, renderedAt: Date.now() };
}
