import { ModeToggle } from "@/components/theme/mode-toggle";
import type { CurrentUser } from "@/lib/auth";
import type { Tables } from "@/types/database";
import { CommandMenu } from "./command-menu";
import { MobileNav } from "./mobile-nav";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

type TopBarProps = {
  user: CurrentUser;
  notifications: Tables<"notifications">[];
  unreadNotifications: number;
  onboardingDone: boolean;
  badges: Record<string, number>;
};

export function TopBar({ user, notifications, unreadNotifications, onboardingDone, badges }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1.5 border-b bg-background px-4 sm:px-6 lg:px-8">
      <MobileNav role={user.role} onboardingDone={onboardingDone} badges={badges} />
      <div className="min-w-0 flex-1">
        <CommandMenu role={user.role} onboardingDone={onboardingDone} />
      </div>
      {/* The editor's Start/Stop working control joins here in Phase 5. */}
      <div className="hidden sm:block">
        <ModeToggle />
      </div>
      <NotificationBell userId={user.id} initial={notifications} initialUnread={unreadNotifications} />
      <UserMenu name={user.full_name} email={user.email} role={user.role} avatarUrl={user.avatar_url} />
    </header>
  );
}
