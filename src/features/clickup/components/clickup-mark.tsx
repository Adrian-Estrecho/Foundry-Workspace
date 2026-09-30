import { cn } from "@/lib/utils";

/** Marks things that come from ClickUp: an up chevron over an arc, in the text colour. */
export function ClickUpMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <path d="M6 11.5 12 6l6 5.5" />
      <path d="M5 16.5c2 2.2 4.4 3.5 7 3.5s5-1.3 7-3.5" />
    </svg>
  );
}
