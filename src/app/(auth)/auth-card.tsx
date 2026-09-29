import type * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { FocusHandles } from "./focus-handles";

const CORNERS = [
  "-top-2.5 -left-2.5 border-t-2 border-l-2 rounded-tl-md",
  "-top-2.5 -right-2.5 border-t-2 border-r-2 rounded-tr-md",
  "-bottom-2.5 -left-2.5 border-b-2 border-l-2 rounded-bl-md",
  "-bottom-2.5 -right-2.5 border-b-2 border-r-2 rounded-br-md",
];

/**
 * The centred card on the auth pages, framed like a viewfinder. The field
 * being edited gets selection handles (FocusHandles).
 */
export function AuthCard({ wide, className, children }: { wide?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative w-full animate-in duration-500 fade-in-0 slide-in-from-bottom-3 motion-reduce:animate-none",
        wide ? "max-w-2xl" : "max-w-[26rem]",
      )}
    >
      {CORNERS.map((corner) => (
        <span key={corner} aria-hidden="true" className={cn("absolute size-5 border-primary", corner)} />
      ))}
      <div className={cn("relative rounded-2xl border bg-card p-6 sm:p-8", className)}>
        {children}
        <FocusHandles />
      </div>
    </div>
  );
}

/**
 * Sign in / Create account switch at the top of both forms. Keeps `next`.
 * The highlight slides in from the other tab, since each is its own page.
 */
export function AuthTabs({ active, next }: { active: "login" | "signup"; next?: string }) {
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  const tabs = [
    { key: "login", href: `/login${query}`, label: "Sign in" },
    { key: "signup", href: `/signup${query}`, label: "Create account" },
  ] as const;

  return (
    <nav aria-label="Account" className="relative grid grid-cols-2 rounded-lg bg-muted p-1">
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-md bg-card shadow-sm animate-in duration-300 ease-out motion-reduce:animate-none",
          active === "login" ? "left-1 slide-in-from-right" : "left-1/2 slide-in-from-left",
        )}
      />
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "relative rounded-md py-1.5 text-center text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tab.key === active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
