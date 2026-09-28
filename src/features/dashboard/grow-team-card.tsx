"use client";

import Link from "next/link";
import { toast } from "sonner";
import { LinkIcon, PlusIcon } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Share the public forms, review applicants. */
export function GrowTeamCard({
  applicants,
  newApplicants,
  className,
}: {
  applicants: { id: string; full_name: string }[];
  newApplicants: number;
  className?: string;
}) {
  const copy = async (path: string, label: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      toast.success(`${label} link copied`);
    } catch {
      toast.error("Couldn't copy. Your browser blocked clipboard access.");
    }
  };

  return (
    <section className={cn("flex flex-col rounded-xl border bg-card p-5", className)}>
      <h2 className="font-heading text-base font-medium">Grow the team, win new clients</h2>
      <p className="mt-1 text-sm text-muted-foreground">Share your intake and editor application forms.</p>

      <div className="mt-4 flex items-center">
        {applicants.slice(0, 3).map((a) => (
          <UserAvatar key={a.id} name={a.full_name} className="-mr-2 size-8 ring-2 ring-card" />
        ))}
        <Link
          href="/editors/applicants"
          aria-label="Review applicants"
          className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground ring-2 ring-card transition-colors hover:text-foreground"
        >
          <PlusIcon className="size-4" />
        </Link>
        {newApplicants > 0 && (
          <span className="ml-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular">{newApplicants}</span> new
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => copy("/intake", "Client intake")}>
          <LinkIcon /> Intake form
        </Button>
        <Button variant="outline" size="sm" onClick={() => copy("/apply", "Editor application")}>
          <LinkIcon /> Application form
        </Button>
      </div>

      <div className="min-h-6 flex-1" />
      <Button asChild className="w-full">
        <Link href="/editors/applicants">Review applicants</Link>
      </Button>
    </section>
  );
}
