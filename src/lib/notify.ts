import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_ACCENT } from "@/lib/theme";

/**
 * Who gets a workspace's admin emails (the owner's and admins' own
 * addresses), plus its name and accent so emails match the app. Emails to
 * people outside the team (applicants, new editors) use `recipients[0]` (the
 * owner, named `ownerName`) as their reply-to.
 */
export async function adminEmailContext(workspaceId: string) {
  const supabase = createAdminClient();
  const [{ data: workspace }, { data: admins }] = await Promise.all([
    supabase.from("workspaces").select("name, default_accent").eq("id", workspaceId).maybeSingle(),
    supabase
      .from("workspace_members")
      .select("role, profile:profiles!workspace_members_user_id_fkey(email, full_name)")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .in("role", ["owner", "admin"]),
  ]);

  const sorted = (admins ?? []).sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0));
  const recipients = sorted.flatMap((admin) => (admin.profile?.email ? [admin.profile.email] : []));
  return {
    recipients,
    ownerName: sorted[0]?.profile?.full_name ?? null,
    accent: workspace?.default_accent ?? DEFAULT_ACCENT,
    companyName: workspace?.name ?? "ReEdit",
  };
}

/**
 * A link into the app that first switches the reader to the right workspace
 * (emails can be opened while another workspace is active).
 */
export function workspaceLink(siteUrl: string, workspaceId: string, path: string) {
  return `${siteUrl}/w/${workspaceId}?next=${encodeURIComponent(path)}`;
}
