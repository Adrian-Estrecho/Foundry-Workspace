"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2Icon, InboxIcon, SearchIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Input } from "@/components/ui/input";
import { useNow } from "@/hooks/use-now";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { InboxItem } from "../queries";

/** Conversations, most recent first, with unread ones marked. Filters as you type. */
export function InboxList({
  items,
  basePath,
  kind,
  renderedAt,
  emptyTitle,
  emptyText,
}: {
  items: InboxItem[];
  basePath: string;
  kind: "editor" | "client";
  renderedAt: number;
  emptyTitle: string;
  emptyText: string;
}) {
  const pathname = usePathname();
  const now = useNow(renderedAt);
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((item) => `${item.name} ${item.subtitle ?? ""}`.toLowerCase().includes(q)) : items;

  if (items.length === 0) {
    return <EmptyState icon={InboxIcon} title={emptyTitle} description={emptyText} className="py-12" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {items.length > 6 && (
        <div className="relative border-b p-2">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search conversations" className="h-8 pl-8" />
        </div>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {shown.map((item) => {
          const href = `${basePath}/${item.id}`;
          const active = pathname === href;
          return (
            <li key={item.id}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                {kind === "editor" ? (
                  <UserAvatar name={item.name} src={item.avatarUrl} className="size-9" />
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
                    <Building2Icon className="size-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", item.unread ? "font-semibold" : "font-medium")}>{item.name}</span>
                    {item.lastMessageAt && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(item.lastMessageAt, now)}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={cn("truncate text-xs", item.unread ? "text-foreground" : "text-muted-foreground")}>
                      {item.preview
                        ? `${item.lastSender === "admin" ? "Team: " : ""}${item.preview}`
                        : (item.subtitle ?? "No messages yet")}
                    </span>
                    {item.unread && <span className="ml-auto size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
        {shown.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No matches.</li>}
      </ul>
    </div>
  );
}
