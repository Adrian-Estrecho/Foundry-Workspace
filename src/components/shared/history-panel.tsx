import { HistoryIcon, InboxIcon } from "lucide-react";
import { timeAgo } from "@/lib/dates";
import { EmptyState, Panel } from "./panel";
import { UserAvatar } from "./user-avatar";

type Entry = {
  id: number;
  summary: string;
  created_at: string;
  actor: { full_name: string; avatar_url: string | null } | null;
};

/** Activity-log entries for one record, newest first. No actor = public form or system. */
export function HistoryPanel({ entries, renderedAt }: { entries: Entry[]; renderedAt: number }) {
  return (
    <Panel title="History">
      {entries.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="Nothing yet" />
      ) : (
        <ol className="grid gap-3">
          {entries.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              {item.actor ? (
                <UserAvatar name={item.actor.full_name} src={item.actor.avatar_url} className="size-7" />
              ) : (
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-strong ring-1 ring-border">
                  <InboxIcon className="size-3.5 text-primary" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm leading-snug">{item.summary}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(item.created_at, renderedAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
