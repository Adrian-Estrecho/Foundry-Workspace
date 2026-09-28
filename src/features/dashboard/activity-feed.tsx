import { ActivityIcon, InboxIcon } from "lucide-react";
import { EmptyState, Panel } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "./queries";

/** Latest events across the company: work started, tasks moved, new leads... */
export function ActivityFeed({ items, renderedAt, className }: { items: ActivityItem[]; renderedAt: number; className?: string }) {
  return (
    <Panel className={className} title="Recent activity">
      {items.length === 0 ? (
        <EmptyState icon={ActivityIcon} title="No activity yet" description="Clock-ins, task updates and new leads appear here." />
      ) : (
        <ol className="relative grid gap-4">
          <span className="absolute top-2 bottom-2 left-[1.1rem] w-px bg-border" aria-hidden="true" />
          {items.map((item) => (
            <li key={item.id} className="relative flex items-start gap-3">
              {item.actorName ? (
                <UserAvatar name={item.actorName} src={item.actorAvatar} className="size-9 ring-2 ring-card" />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted ring-2 ring-card">
                  <InboxIcon className="size-4 text-primary" />
                </span>
              )}
              <div className="min-w-0 pt-0.5">
                <p className={cn("text-sm leading-snug", !item.actorName && "font-medium")}>{item.summary}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(item.createdAt, renderedAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
