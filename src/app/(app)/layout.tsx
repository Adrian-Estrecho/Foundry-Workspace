import { cookies } from "next/headers";
import { AppSidebar, SIDEBAR_COOKIE } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { PresenceProvider } from "@/components/presence/presence-provider";
import { AccentStyle } from "@/components/theme/accent-style";
import { NOTIFICATION_PAGE_SIZE } from "@/features/notifications/constants";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Signed-in shell: accent, sidebar, top bar, live presence. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const supabase = await createClient();
  const cookieStore = await cookies();

  const [settings, notifications, unreadNotifications, unreadAnnouncements, editor] = await Promise.all([
    supabase.from("app_settings").select("default_accent").eq("id", 1).maybeSingle(),
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
    supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .gt("created_at", user.announcements_seen_at),
    user.role === "editor"
      ? supabase.from("editors").select("onboarding_completed_at").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const onboardingDone = user.role === "admin" || Boolean(editor.data?.onboarding_completed_at);
  const badges = { "/announcements": unreadAnnouncements.count ?? 0 };
  const accent = user.accent_color ?? settings.data?.default_accent;

  return (
    <PresenceProvider userId={user.id}>
      <AccentStyle accent={accent} tint={user.tint_background} />
      <div className="flex min-h-dvh">
        <AppSidebar
          role={user.role}
          onboardingDone={onboardingDone}
          badges={badges}
          defaultExpanded={cookieStore.get(SIDEBAR_COOKIE)?.value !== "collapsed"}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            user={user}
            notifications={notifications.data ?? []}
            unreadNotifications={unreadNotifications.count ?? 0}
            onboardingDone={onboardingDone}
            badges={badges}
          />
          <main className="flex-1 px-4 pt-6 pb-12 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </PresenceProvider>
  );
}
