import Link from "next/link";
import { cn } from "@/lib/utils";

type Tab = "announcements" | "team" | "clients";

/**
 * Announcements for everyone; private threads with the team (admins see
 * every editor's, an editor their own with the admins) and with clients.
 */
export function MessagesTabs({
  active,
  isAdmin,
  clients,
  counts,
}: {
  active: Tab;
  isAdmin: boolean;
  clients: boolean;
  counts: { announcements: number; team: number; clients: number };
}) {
  const tabs: { key: Tab; href: string; label: string; count: number }[] = [
    { key: "announcements", href: "/messages", label: "Announcements", count: counts.announcements },
    { key: "team", href: "/messages/team", label: isAdmin ? "Team" : "Admins", count: counts.team },
    ...(clients ? [{ key: "clients" as const, href: "/messages/clients", label: "Clients", count: counts.clients }] : []),
  ];

  return (
    <nav aria-label="Messages" className="mb-4 inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-0.5 scrollbar-none">
      {tabs.map((tab) => {
        const current = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              current ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular">
                {tab.count}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
