"use client";

import * as React from "react";
import { BellIcon, CheckCheckIcon, Loader2Icon } from "lucide-react";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { addDays, formatDay } from "@/lib/dates";
import type { Notification, NotificationFilter, NotificationsStore } from "../use-notifications";
import { NotificationItem } from "./notification-item";

/** The viewer's local calendar day, as YYYY-MM-DD. */
const localDay = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n) => String(n).padStart(2, "0")).join("-");

function dayLabel(day: string, today: string) {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  return day.slice(0, 4) === today.slice(0, 4)
    ? formatDay(day)
    : formatDay(day, { month: "short", day: "numeric", year: "numeric" });
}

function groupByDay(rows: Notification[]) {
  const today = localDay(new Date());
  const groups: { day: string; label: string; rows: Notification[] }[] = [];
  for (const row of rows) {
    const day = localDay(new Date(row.created_at));
    const last = groups.at(-1);
    if (last?.day === day) last.rows.push(row);
    else groups.push({ day, label: dayLabel(day, today), rows: [row] });
  }
  return groups;
}

/** Every notification, newest first, loading older pages as you scroll. */
export function AllNotificationsDialog({
  open,
  onOpenChange,
  store,
  onOpenNotification,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: NotificationsStore;
  onOpenNotification: (notification: Notification) => void;
}) {
  const [filter, setFilter] = React.useState<NotificationFilter>("all");
  const [sentinel, setSentinel] = React.useState<HTMLDivElement | null>(null);
  const { unread, loadMore } = store;
  const { rows, hasMore, loading, failed } = store.view(filter);
  const groups = groupByDay(rows);

  // Pull in the next page once the end of the list scrolls into view.
  React.useEffect(() => {
    if (!open || !sentinel || !hasMore || loading || failed) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore(filter);
      },
      { root: sentinel.closest('[data-slot="scroll-area-viewport"]'), rootMargin: "0px 0px 240px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, sentinel, hasMore, loading, failed, filter, loadMore]);

  const filters: { value: NotificationFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "unread", label: unread ? `Unread (${unread})` : "Unread" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(42rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1 px-5 pt-5 pb-4">
          <DialogTitle className="text-lg">Notifications</DialogTitle>
          <DialogDescription>{unread ? `${unread} unread` : "You're all caught up"}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 border-b px-5 pb-3">
          <Segmented label="Show" value={filter} onChange={setFilter} options={filters} />
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={store.markAllRead}>
              <CheckCheckIcon />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea key={filter} className="min-h-0 flex-1">
          {rows.length === 0 && !hasMore ? (
            <div className="grid place-items-center gap-2 px-6 py-16 text-center">
              {filter === "unread" ? (
                <CheckCheckIcon className="size-6 text-muted-foreground" />
              ) : (
                <BellIcon className="size-6 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {filter === "unread"
                  ? "You're all caught up."
                  : "Nothing yet. We'll let you know when something needs you."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-3">
              {groups.map((group) => (
                <section key={group.day} aria-label={group.label}>
                  <h3 className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">{group.label}</h3>
                  <ul className="grid grid-cols-1 gap-0.5">
                    {group.rows.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onOpen={onOpenNotification}
                        onMarkRead={(id) => void store.markRead([id])}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <div ref={setSentinel} className="grid min-h-4 place-items-center px-3 pb-4 text-xs text-muted-foreground">
            {loading ? (
              <Loader2Icon className="size-4 animate-spin" aria-label="Loading more" />
            ) : failed ? (
              <Button variant="ghost" size="sm" onClick={() => void loadMore(filter)}>
                Couldn&apos;t load more. Try again
              </Button>
            ) : !hasMore && rows.length > 0 ? (
              "No older notifications"
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
