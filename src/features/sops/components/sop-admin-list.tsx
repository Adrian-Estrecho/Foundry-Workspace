import Link from "next/link";
import { BookOpenIcon, FileEditIcon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

type Row = {
  id: string;
  title: string;
  category: Enums<"sop_category">;
  required: boolean;
  published: boolean;
  updatedAt: string;
  readBy: number;
};

/** An admin's SOPs in one category: drafts included, with who has read each one. */
export function SopAdminList({ sops, teamSize, renderedAt }: { sops: Row[]; teamSize: number; renderedAt: number }) {
  return (
    <ul className="grid grid-cols-1 gap-2">
      {sops.map((sop) => {
        const allRead = teamSize > 0 && sop.readBy >= teamSize;
        return (
          <li key={sop.id} className="flex items-center gap-3 rounded-lg bg-surface p-3 ring-1 ring-border">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
              {sop.published ? <BookOpenIcon className="size-5" /> : <FileEditIcon className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <Link href={`/sops/${sop.id}/edit`} className="truncate text-sm font-medium hover:underline">
                  {sop.title}
                </Link>
                {sop.required && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">Required</span>}
                {!sop.published && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Draft</span>}
              </span>
              <span className="block text-xs text-muted-foreground">
                {sop.published ? (
                  <span className={cn(allRead && "text-success")}>
                    Read by {sop.readBy} of {teamSize} {teamSize === 1 ? "editor" : "editors"}
                  </span>
                ) : (
                  "Only admins can see drafts"
                )}{" "}
                · updated {timeAgo(sop.updatedAt, renderedAt)}
              </span>
            </span>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/sops/${sop.id}/edit`}>
                <PencilIcon /> Edit
              </Link>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
