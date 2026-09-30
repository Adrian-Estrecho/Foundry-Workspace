import * as React from "react";
import { PageHeader } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { cn } from "@/lib/utils";
import { MessagesTabs } from "./messages-tabs";

/** Page heading and tabs shared by every Messages page, with live unread counts. */
export function MessagesFrame({
  tab,
  isAdmin,
  clients,
  counts,
  children,
}: {
  tab: "announcements" | "team" | "clients";
  /** Admins read every editor's thread; editors have their own line to the admins. */
  isAdmin: boolean;
  /** Shows the Clients tab (admins and people who manage clients). */
  clients: boolean;
  counts: { announcements: number; team: number; clients: number };
  children: React.ReactNode;
}) {
  return (
    <>
      <RealtimeRefresh channel={`messages-${tab}`} tables="message_threads,announcements,announcement_comments,announcement_reactions" />
      <PageHeader
        title="Messages"
        description={
          isAdmin
            ? "Announcements for the team, and private conversations with editors and clients."
            : clients
              ? "Announcements from the team, a private line to the admins, and conversations with clients."
              : "Announcements from the team, and a private line to the admins."
        }
      />
      <MessagesTabs active={tab} isAdmin={isAdmin} clients={clients} counts={counts} />
      {children}
    </>
  );
}

/**
 * Two panes: conversations on the left, the open one on the right. On
 * phones it's one or the other.
 */
export function InboxShell({ list, selected, children }: { list: React.ReactNode; selected: boolean; children: React.ReactNode }) {
  return (
    <div className="grid h-[calc(100dvh-16.5rem)] min-h-[28rem] grid-cols-1 overflow-hidden rounded-xl border bg-card lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className={cn("min-h-0 flex-col border-r", selected ? "hidden lg:flex" : "flex")} aria-label="Conversations">
        {list}
      </aside>
      <div className={cn("min-h-0 flex-col", selected ? "flex" : "hidden lg:flex")}>{children}</div>
    </div>
  );
}
