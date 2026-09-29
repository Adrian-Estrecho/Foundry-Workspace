import "server-only";
import type { SetupProgress } from "@/features/dashboard/getting-started";
import type { Workspace } from "@/lib/auth";
import { env } from "@/lib/env";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** The owners and admins of a workspace, with their names (for mentions and badges). */
export async function workspaceAdmins(supabase: Client, workspaceId: string) {
  const { data } = await supabase
    .from("workspace_members")
    .select("profile:profiles!workspace_members_user_id_fkey(id, full_name, avatar_url)")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .in("role", ["owner", "admin"]);
  return (data ?? []).flatMap((row) => (row.profile ? [row.profile] : []));
}

/** How far a workspace is through its first steps (the admin dashboard's Getting started). */
export async function getSetupProgress(supabase: Client, workspace: Workspace): Promise<SetupProgress> {
  const count = { count: "exact" as const, head: true };
  const [applicants, clients, settings] = await Promise.all([
    supabase.from("applicants").select("id", count),
    supabase.from("clients").select("id", count),
    supabase.from("workspace_settings").select("test_title").maybeSingle(),
  ]);
  return {
    applyUrl: `${env.siteUrl}/apply/${workspace.slug}`,
    intakeUrl: `${env.siteUrl}/intake/${workspace.slug}`,
    hasApplicants: (applicants.count ?? 0) > 0,
    hasOnboardingLinks: Boolean(workspace.contract_template_url || workspace.frameio_invite_url || workspace.asset_pack_url),
    hasTestEdit: Boolean(settings.data?.test_title),
    hasClients: (clients.count ?? 0) > 0,
  };
}
