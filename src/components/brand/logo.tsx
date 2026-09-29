import { cn } from "@/lib/utils";

/** Corner handles of the selected element (the fourth sits under the cursor). */
const HANDLES = [
  [2.75, 5.25],
  [22.25, 5.25],
  [2.75, 22.75],
];

/**
 * ReEdit's mark: a cursor editing a selected element. The element takes the
 * current accent; the cursor is the text colour, outlined in the page colour.
 * The box is centred in the square, so it lines up with text beside it.
 * Keep in step with app/icon.svg.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect
        x="4.75"
        y="7.25"
        width="19.5"
        height="17.5"
        rx="3.5"
        fill="var(--primary)"
        fillOpacity="0.2"
        stroke="var(--primary)"
        strokeWidth="1.5"
      />
      {HANDLES.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width="4"
          height="4"
          rx="1"
          fill="var(--background)"
          stroke="var(--primary)"
          strokeWidth="1.5"
        />
      ))}
      <path
        d="M19 16.5v12l2.88-2.72 2.08 4.64 2.16-.96-2.08-4.48h3.92Z"
        fill="var(--foreground)"
        stroke="var(--background)"
        strokeWidth="3"
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-heading text-xl font-semibold tracking-tight">ReEdit</span>
    </span>
  );
}
