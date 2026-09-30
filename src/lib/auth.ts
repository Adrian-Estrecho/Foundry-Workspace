import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizePermissions, PERMISSION_KEYS, type Permission } from "@/lib/permissions";
import type { Enums, Tables } from "@/types/database";

/** The signed-in person's profile, shared by every workspace they're in. */
export type Account = Tables<"profiles">;

export type Workspace = Tables<"workspaces">;

export type Membership = {
  workspace: Workspace;
  role: Enums<"member_role">;
  status: Enums<"member_status">;
  /** Their access title, e.g. "Operational control"; null shows the role. */
  title: string | null;
  /** Abilities an admin gave them (editors only; admins have them all). */
  permissions: string[];
  announcementsSeenAt: string;
};

/** How the app treats someone: owners and admins are both "admin". */
export type AppRole = "admin" | "editor";

export type CurrentUser = Account & {
  role: AppRole;
  memberRole: Enums<"member_role">;
  /** "onboarding" until the workspace approves them (editors only). */
  memberStatus: Enums<"member_status">;
  workspace: Workspace;
  /** Access title in this workspace; null shows the role. */
  title: string | null;
  /**
   * What they may do beyond an editor's own work: every ability for owners
   * and admins, what they were given for approved editors, none while onboarding.
   */
  permissions: Permission[];
  announcementsSeenAt: string;
  /** Every workspace they can switch to, current one included. */
  memberships: Membership[];
};

/**
 * The signed-in user's profile with all their memberships, in one round trip.
 * Memoised per request, so layouts, pages and actions can all call it.
 */
const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "*, memberships:workspace_members!workspace_members_user_id_fkey(role, status, title, permissions, joined_at, announcements_seen_at, workspace:workspaces(*))",
    )
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;
  const { memberships, ...account } = profile;
  return { account, memberships };
});

/** The signed-in user's profile, or null. */
export async function getAccount(): Promise<Account | null> {
  return (await getSession())?.account ?? null;
}

/**
 * The signed-in user in their current workspace, or null when they aren't
 * signed in or don't belong to a workspace yet. If their active workspace is
 * no longer theirs (or was never set), the most recent one they joined takes
 * its place, since RLS only shows rows from the active workspace.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const { account } = session;

  // Newest first, so a fallback workspace is the one they joined last.
  const memberships: Membership[] = session.memberships
    .filter((row) => row.status === "onboarding" || row.status === "active")
    .sort((a, b) => Date.parse(b.joined_at) - Date.parse(a.joined_at))
    .flatMap((row) =>
      row.workspace
        ? [
            {
              workspace: row.workspace,
              role: row.role,
              status: row.status,
              title: row.title,
              permissions: row.permissions,
              announcementsSeenAt: row.announcements_seen_at,
            },
          ]
        : [],
    );
  if (memberships.length === 0) return null;

  let current = memberships.find((m) => m.workspace.id === account.active_workspace_id);
  if (!current) {
    current = memberships[0];
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_active_workspace", { p_workspace_id: current.workspace.id });
    if (error) return null;
  }

  memberships.sort((a, b) => a.workspace.name.localeCompare(b.workspace.name));
  const role: AppRole = current.role === "editor" ? "editor" : "admin";
  return {
    ...account,
    active_workspace_id: current.workspace.id,
    role,
    memberRole: current.role,
    memberStatus: current.status,
    workspace: current.workspace,
    title: current.title,
    permissions:
      role === "admin" ? PERMISSION_KEYS : current.status === "active" ? normalizePermissions(current.permissions) : [],
    announcementsSeenAt: current.announcementsSeenAt,
    memberships,
  };
});

/** For pages that only need an account: welcome, joining, passwords. */
export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect("/login");
  return account;
}

/**
 * For pages and actions inside a workspace. People without one go to the
 * welcome page. Editors still onboarding only get the pages and actions that
 * opt in with `allowOnboarding`; everything else sends them to Onboarding.
 * (RLS enforces the same limits on the data.)
 */
export async function requireUser({ allowOnboarding = false } = {}): Promise<CurrentUser> {
  await requireAccount();
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  if (user.memberStatus === "onboarding" && !allowOnboarding) redirect("/onboarding");
  return user;
}

/** For admin-only pages and actions. Editors are sent to their dashboard. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

export const isAdmin = (user: Pick<CurrentUser, "role">) => user.role === "admin";

/** Whether they hold an ability (owners and admins hold them all). */
export const can = (user: Pick<CurrentUser, "permissions">, permission: Permission) => user.permissions.includes(permission);

/**
 * For pages and actions behind an ability: passes anyone who holds at least
 * one of those given. Everyone else is sent to their dashboard.
 */
export async function requirePermission(...permissions: Permission[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!permissions.some((permission) => can(user, permission))) redirect("/dashboard");
  return user;
}

/**
 * Where a just-signed-in person starts: their dashboard, or the welcome page
 * when they don't belong to a workspace yet (saves a redirect).
 */
export async function homePath(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { count } = await supabase
    .from("workspace_members")
    .select("workspace_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["onboarding", "active"]);
  return count ? "/dashboard" : "/welcome";
}

/** An editor the workspace hasn't approved yet: limited access. */
export const isOnboarding = (user: Pick<CurrentUser, "memberStatus">) => user.memberStatus === "onboarding";
