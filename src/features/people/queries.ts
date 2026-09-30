import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { normalizePermissions, type Permission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export type Person = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Enums<"member_role">;
  /** "onboarding" until an editor is approved. */
  status: Enums<"member_status">;
  /** Their access title; null shows the role. */
  title: string | null;
  /** Abilities given to them (they matter for editors only). */
  permissions: Permission[];
  joinedAt: string;
};

/** Everyone in the workspace now (onboarding and active), owner first, then by name. */
export async function getPeople(user: CurrentUser): Promise<Person[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      "user_id, role, status, title, permissions, joined_at, profile:profiles!workspace_members_user_id_fkey(full_name, email, avatar_url)",
    )
    .eq("workspace_id", user.workspace.id)
    .in("status", ["onboarding", "active"]);
  if (error) throw error;

  const rank = { owner: 0, admin: 1, editor: 2 } as const;
  return (data ?? [])
    .map((m) => ({
      id: m.user_id,
      name: m.profile?.full_name ?? "Member",
      email: m.profile?.email ?? "",
      avatarUrl: m.profile?.avatar_url ?? null,
      role: m.role,
      status: m.status,
      title: m.title,
      permissions: normalizePermissions(m.permissions),
      joinedAt: m.joined_at,
    }))
    .sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name));
}
