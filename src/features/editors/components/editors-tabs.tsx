import Link from "next/link";
import { cn } from "@/lib/utils";

/** Switches between the roster and the applicant pipeline. */
export function EditorsTabs({ current, newApplicants }: { current: "roster" | "applicants"; newApplicants: number }) {
  const tabs = [
    { key: "roster", href: "/editors", label: "Roster" },
    { key: "applicants", href: "/editors/applicants", label: "Applicants", count: newApplicants },
  ] as const;

  return (
    <nav aria-label="Editors" className="mb-5 inline-flex rounded-lg bg-muted p-0.5">
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {"count" in tab && tab.count > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 text-xs font-medium text-primary tabular">{tab.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
