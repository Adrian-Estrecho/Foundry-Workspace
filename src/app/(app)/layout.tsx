import { cookies } from "next/headers";
import { AppSidebar, SIDEBAR_COOKIE, type SwitcherProps } from "@/components/layout/app-sidebar";
import type { NavAccess } from "@/components/layout/nav-config";
import { TopBar } from "@/components/layout/top-bar";
import { PresenceProvider } from "@/components/presence/presence-provider";
import { AccentStyle } from "@/components/theme/accent-style";
import { getWorkState } from "@/features/attendance/queries";
import { NOTIFICATION_PAGE_SIZE } from "@/features/notifications/constants";
import { WorkspaceSync } from "@/features/workspaces/components/workspace-switcher";
import { memberLabel, workspaceLogoUrl } from "@/features/workspaces/constants";
import { isOnboarding, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Signed-in shell: accent, workspace switcher, sidebar, top bar, live presence. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Onboarding editors get the shell too; each page decides what they may see.
  const user = await requireUser({ allowOnboarding: true });
  const supabase = await createClient();
  const cookieStore = await cookies();
  const onboarding = isOnboarding(user);

  const [notifications, unreadNotifications, unreadAnnouncements, unreadThreads, work] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(NOTIFICATION_PAGE_SIZE),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
    onboarding
      ? Promise.resolve({ count: 0 })
      : supabase
          .from("announcements")
          .select("id", { count: "exact", head: true })
          .gt("created_at", user.announcementsSeenAt),
    onboarding ? Promise.resolve({ data: [] }) : supabase.rpc("unread_threads"),
    getWorkState(user),
  ]);

  const access: NavAccess = { role: user.role, onboarding };
  const badges = { "/messages": (unreadAnnouncements.count ?? 0) + (unreadThreads.data?.length ?? 0) };
  const accent = user.accent_color ?? user.workspace.default_accent;
  const toSwitcher = (m: CurrentUserMembership) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    label: memberLabel(m.role, m.status),
    logoUrl: workspaceLogoUrl(m.workspace.logo_path),
  });
  const switcher: SwitcherProps = {
    current: toSwitcher({ workspace: user.workspace, role: user.memberRole, status: user.memberStatus }),
    workspaces: user.memberships.map(toSwitcher),
  };

  return (
    <PresenceProvider userId={user.id} workspaceId={user.workspace.id} enabled={!onboarding}>
      <AccentStyle accent={accent} tint={user.tint_background} />
      <WorkspaceSync workspaceId={user.workspace.id} />
      <div className="flex min-h-dvh">
        <AppSidebar
          access={access}
          badges={badges}
          switcher={switcher}
          defaultExpanded={cookieStore.get(SIDEBAR_COOKIE)?.value !== "collapsed"}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            user={user}
            notifications={notifications.data ?? []}
            unreadNotifications={unreadNotifications.count ?? 0}
            access={access}
            badges={badges}
            switcher={switcher}
            work={work}
          />
          <main className="flex-1 px-4 pt-6 pb-12 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </PresenceProvider>
  );
}

type CurrentUserMembership = Pick<Awaited<ReturnType<typeof requireUser>>["memberships"][number], "workspace" | "role" | "status">;
