import { cn } from "@/lib/utils";

/** Foundry's faceted mark. Coloured by the current accent. */
export function FoundryMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <path d="M16 2.5 27.5 11 16 29.5 4.5 11Z" fill="var(--primary)" opacity="0.45" />
      <path d="M16 2.5 21.5 11 16 29.5Z" fill="var(--primary)" />
      <path d="M16 2.5 10.5 11 16 29.5Z" fill="var(--primary)" opacity="0.78" />
      <path d="M4.5 11h23L21.5 11 16 2.5 10.5 11Z" fill="white" opacity="0.28" />
      <path d="M10.5 11h11L16 29.5Z" fill="white" opacity="0.12" />
    </svg>
  );
}

export function FoundryLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <FoundryMark />
      <span className="font-heading text-xl font-semibold tracking-tight">Foundry</span>
    </span>
  );
}
