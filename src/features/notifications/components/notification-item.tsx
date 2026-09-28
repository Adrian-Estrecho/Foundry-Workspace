"use client";

import {
  AlarmClockIcon,
  BellIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  CheckIcon,
  EyeIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  RocketIcon,
  RotateCcwIcon,
  SparklesIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";
import type { Notification } from "../use-notifications";

const ICONS: Partial<Record<Enums<"notification_type">, LucideIcon>> = {
  new_lead: SparklesIcon,
  new_applicant: UserPlusIcon,
  editor_onboarded: RocketIcon,
  task_for_review: EyeIcon,
  task_overdue: AlarmClockIcon,
  task_assigned: CheckCheckIcon,
  task_due_tomorrow: CalendarClockIcon,
  revision_requested: RotateCcwIcon,
  new_announcement: MegaphoneIcon,
  meeting_reminder: CalendarClockIcon,
  mention: MessageSquareIcon,
};

/**
 * One notification row. `compact` keeps each line to a single truncated line
 * (the bell); otherwise the text wraps (the full list). The unread dot doubles
 * as a "mark as read" button.
 */
export function NotificationItem({
  notification,
  onOpen,
  onMarkRead,
  compact = false,
}: {
  notification: Notification;
  onOpen: (notification: Notification) => void;
  onMarkRead: (id: string) => void;
  compact?: boolean;
}) {
  const Icon = ICONS[notification.type] ?? BellIcon;
  const unread = !notification.read_at;

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="flex w-full items-start gap-3 rounded-lg p-2.5 pr-9 text-left transition-colors outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm", compact ? "truncate" : "line-clamp-2", unread && "font-medium")}>
            {notification.title}
          </span>
          {notification.body && (
            <span className={cn("block text-xs text-muted-foreground", compact ? "truncate" : "line-clamp-3")}>
              {notification.body}
            </span>
          )}
          <time dateTime={notification.created_at} className="mt-0.5 block text-xs text-muted-foreground">
            {timeAgo(notification.created_at)}
          </time>
        </span>
      </button>
      {unread && (
        <button
          type="button"
          onClick={() => onMarkRead(notification.id)}
          aria-label={`Mark "${notification.title}" as read`}
          title="Mark as read"
          className="group/mark absolute top-2 right-1.5 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="size-2 rounded-full bg-primary group-hover/mark:hidden group-focus-visible/mark:hidden" />
          <CheckIcon className="hidden size-3.5 group-hover/mark:block group-focus-visible/mark:block" />
        </button>
      )}
    </li>
  );
}
