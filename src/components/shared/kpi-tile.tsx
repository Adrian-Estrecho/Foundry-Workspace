import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "default" | "danger" | "success";

/** Compact metric tile for the KPI strip. */
export function KpiTile({
  label,
  value,
  icon: Icon,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  hint?: React.ReactNode;
  href?: string;
  tone?: Tone;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-muted-foreground">{label}</span>
        <Icon
          className={cn(
            "size-4 shrink-0",
            tone === "danger" && "text-danger",
            tone === "success" && "text-success",
            tone === "default" && "text-muted-foreground",
          )}
        />
      </div>
      <div className={cn("mt-2 font-heading text-2xl font-semibold tracking-tight tabular", tone === "danger" && "text-danger")}>
        {value}
      </div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div>}
    </>
  );

  const className = cn(
    "block min-w-0 rounded-xl border bg-card p-4 transition-colors",
    tone === "danger" && "border-danger/35",
    href && "hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring outline-none",
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
