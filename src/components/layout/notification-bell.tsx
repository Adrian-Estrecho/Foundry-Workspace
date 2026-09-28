"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AllNotificationsDialog } from "@/features/notifications/components/all-notifications-dialog";
import { NotificationItem } from "@/features/notifications/components/notification-item";
import { useNotifications, type Notification } from "@/features/notifications/use-notifications";

/** How many of the newest notifications the bell lists before "View all". */
const BELL_LIMIT = 15;

/** Bell with the newest notifications, and a full scrollable list behind "View all". */
export function NotificationBell({
  userId,
  initial,
  initialUnread,
}: {
  userId: string;
  initial: Notification[];
  initialUnread: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [allOpen, setAllOpen] = React.useState(false);
  const store = useNotifications(userId, initial, initialUnread);
  const { unread } = store;
  const items = store.view("all").rows.slice(0, BELL_LIMIT);

  const openNotification = (notification: Notification) => {
    if (!notification.read_at) void store.markRead([notification.id]);
    setOpen(false);
    setAllOpen(false);
    if (notification.link) router.push(notification.link);
  };

  const viewAll = () => {
    setOpen(false);
    setAllOpen(true);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          >
            <BellIcon />
            {unread > 0 && (
              <span className="absolute top-2 right-2 size-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] gap-0 rounded-xl p-0">
          <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
            <div>
              <p className="font-heading font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">{unread ? `${unread} unread` : "You're all caught up"}</p>
            </div>
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={store.markAllRead}>
                Mark all read
              </Button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="grid place-items-center gap-2 px-6 py-12 text-center">
              <BellIcon className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nothing yet. We&apos;ll let you know when something needs you.</p>
            </div>
          ) : (
            <>
              <ScrollArea className="max-h-[min(26rem,60dvh)]">
                <ul className="grid grid-cols-1 gap-0.5 p-2">
                  {items.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onOpen={openNotification}
                      onMarkRead={(id) => void store.markRead([id])}
                      compact
                    />
                  ))}
                </ul>
              </ScrollArea>
              <div className="border-t p-1.5">
                <Button variant="ghost" size="sm" className="w-full" onClick={viewAll}>
                  View all notifications
                </Button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>

      <AllNotificationsDialog
        open={allOpen}
        onOpenChange={setAllOpen}
        store={store}
        onOpenNotification={openNotification}
      />
    </>
  );
}
