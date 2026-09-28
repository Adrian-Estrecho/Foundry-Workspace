"use client";

import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5];

/** Read-only 1–5 stars. */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`Rated ${value} out of 5`}>
      {STARS.map((star) => (
        <StarIcon
          key={star}
          className={cn("size-3.5", star <= value ? "fill-warning text-warning" : "text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}

/** Pick a rating; choosing the current rating again clears it. */
export function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Rating" className="inline-flex items-center gap-1">
      {STARS.map((star) => {
        const filled = value !== null && star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            disabled={disabled}
            onClick={() => onChange(value === star ? null : star)}
            className="group rounded-md p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <StarIcon
              className={cn(
                "size-6 transition-colors",
                filled ? "fill-warning text-warning" : "text-muted-foreground/40 group-hover:text-warning/70",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
