import { ModeToggle } from "@/components/theme/mode-toggle";
import { WorkControl } from "@/features/attendance/components/work-control";
import type { WorkState } from "@/features/attendance/queries";
import type { CurrentUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import type { Tables } from "@/types/database";
import { CommandMenu } from "./command-menu";
import { MobileNav } from "./mobile-nav";
import { NotificationBell } from "./notification-bell";
import type { SwitcherProps } from "./app-sidebar";
import type { NavAccess } from "./nav-config";
import { UserMenu } from "./user-menu";

type TopBarProps = {
  user: CurrentUser;
  notifications: Tables<"notifications">[];
  unreadNotifications: number;
  access: NavAccess;
  badges: Record<string, number>;
  switcher: SwitcherProps;
  /** The editor's clock (approved editors only). */
  work: WorkState | null;
};

export function TopBar({ user, notifications, unreadNotifications, access, badges, switcher, work }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1.5 border-b bg-background px-4 sm:px-6 lg:px-8">
      <MobileNav access={access} badges={badges} switcher={switcher} />
      <div className="min-w-0 flex-1">
        <CommandMenu access={access} switcher={switcher} />
      </div>
      {work && (
        <div className="mr-1 min-w-0">
          <WorkControl userId={user.id} state={work} today={todayIn(user.timezone)} />
        </div>
      )}
      <div className="hidden sm:block">
        <ModeToggle />
      </div>
      <NotificationBell userId={user.id} initial={notifications} initialUnread={unreadNotifications} />
      <UserMenu name={user.full_name} email={user.email} role={switcher.current.label} avatarUrl={user.avatar_url} />
    </header>
  );
}
