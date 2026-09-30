import Link from "next/link";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StatusDef } from "../constants";
import { StatusChip } from "./status-chip";

/** One status list at a glance, with a link to edit it. */
export function StatusSummary({ label, statuses, href }: { label: string; statuses: StatusDef[]; href: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg bg-surface p-4 ring-1 ring-border">
      <div className="min-w-0 flex-1 basis-60">
        <p className="text-sm font-medium">{label}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {statuses.map((status) => (
            <StatusChip key={status.id} status={status} />
          ))}
        </div>
      </div>
      <Button asChild size="sm" variant="secondary" className="shrink-0 bg-surface-strong ring-1 ring-border">
        <Link href={href}>
          <PencilIcon /> Edit
        </Link>
      </Button>
    </div>
  );
}
