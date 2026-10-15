import Link from "next/link";
import { KanbanSquareIcon, Link2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEWS = [
  { value: "pipeline", href: "/clients", label: "Pipeline", icon: KanbanSquareIcon },
  { value: "links", href: "/clients/links", label: "Links", icon: Link2Icon },
] as const;

/** The Clients page's views as tabs, like the task views. */
export function ClientViewNav({ active }: { active: (typeof VIEWS)[number]["value"] }) {
  return (
    <nav aria-label="Client views" className="mb-4 inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-0.5 scrollbar-none">
      {VIEWS.map((view) => (
        <Link
          key={view.value}
          href={view.href}
          aria-current={view.value === active ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            view.value === active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <view.icon className="size-4" />
          {view.label}
        </Link>
      ))}
    </nav>
  );
}
