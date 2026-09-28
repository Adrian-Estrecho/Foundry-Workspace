"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ACCENT_PRESETS, HEX_PATTERN } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Preset swatches plus a free colour picker. Controlled: the parent decides
 * what to do with the value (live preview, saving).
 */
export function AccentPicker({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (hex: string) => void;
  /** When set, a hidden input carries the value in a <form>. */
  name?: string;
}) {
  const [draft, setDraft] = React.useState(value);
  const [lastValue, setLastValue] = React.useState(value);
  // Keep the hex text box in step when the value changes from outside.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  const isPreset = ACCENT_PRESETS.some((p) => p.hex.toLowerCase() === value.toLowerCase());

  return (
    <div className="grid gap-4">
      {name && <input type="hidden" name={name} value={value} />}
      <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Accent colour">
        {ACCENT_PRESETS.map((preset) => {
          const selected = preset.hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={preset.hex}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(preset.hex)}
              className="group grid justify-items-center gap-1.5 outline-none"
            >
              <span
                className={cn(
                  "grid size-11 place-items-center rounded-2xl ring-2 ring-offset-2 ring-offset-background transition-transform group-hover:scale-105 group-focus-visible:ring-foreground",
                  selected ? "ring-foreground" : "ring-transparent",
                )}
                style={{ background: preset.hex }}
              >
                {selected && <CheckIcon className="size-5 text-white drop-shadow" />}
              </span>
              <span className={cn("text-xs", selected ? "text-foreground" : "text-muted-foreground")}>{preset.name}</span>
            </button>
          );
        })}

        {/* Custom colour */}
        <label className="group grid cursor-pointer justify-items-center gap-1.5">
          <span
            className={cn(
              "relative grid size-11 place-items-center overflow-hidden rounded-2xl ring-2 ring-offset-2 ring-offset-background",
              !isPreset ? "ring-foreground" : "ring-transparent",
            )}
            style={{
              background: !isPreset
                ? value
                : "conic-gradient(from 0deg, #f43f5e, #f59e0b, #84cc16, #14b8a6, #3b82f6, #8b5cf6, #f43f5e)",
            }}
          >
            <input
              type="color"
              value={value}
              onChange={(event) => onChange(event.target.value.toUpperCase())}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-label="Custom colour"
            />
            {!isPreset && <CheckIcon className="pointer-events-none size-5 text-white drop-shadow" />}
          </span>
          <span className={cn("text-xs", !isPreset ? "text-foreground" : "text-muted-foreground")}>Custom</span>
        </label>
      </div>

      <div className="flex max-w-56 items-center gap-2">
        <span className="size-10 shrink-0 rounded-xl ring-1 ring-border" style={{ background: value }} />
        <Input
          value={draft}
          onChange={(event) => {
            const next = event.target.value.trim();
            setDraft(next);
            if (HEX_PATTERN.test(next)) onChange(next.toUpperCase());
          }}
          aria-label="Hex colour"
          spellCheck={false}
          className="font-mono uppercase"
          maxLength={7}
        />
      </div>
    </div>
  );
}
