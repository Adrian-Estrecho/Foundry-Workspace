import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `<form onSubmit={submitWith(save)}>`: hands the form's data to `save`
 * without React's automatic reset of `<form action>`, so typed values stay
 * put when the server sends back validation errors.
 */
export const submitWith =
  (handler: (formData: FormData) => void) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handler(new FormData(event.currentTarget));
  };

/**
 * Label wrapping its control, so clicking the label focuses the field.
 * Shows a hint, or the field's error when there is one.
 */
export function FormRow({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("grid content-start gap-2", className)}>
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-primary"> *</span>}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

/** Like FormRow, for a group of controls (checkboxes, radios): a fieldset with a legend. */
export function FieldGroup({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={cn("grid content-start gap-2", className)}>
      <legend className="mb-2 text-sm font-medium">
        {label}
        {required && <span className="text-primary"> *</span>}
      </legend>
      {children}
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </fieldset>
  );
}

/** Multi-select as toggleable pills. Real checkboxes, so FormData.getAll(name) works. */
export function CheckboxChips({
  name,
  options,
  defaultValue = [],
}: {
  name: string;
  options: readonly string[];
  defaultValue?: readonly string[];
}) {
  // Keep values that aren't in the list (e.g. added by hand before) selectable.
  const all = [...options, ...defaultValue.filter((value) => !options.includes(value))];
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((option) => (
        <label key={option} className="cursor-pointer">
          <input
            type="checkbox"
            name={name}
            value={option}
            defaultChecked={defaultValue.includes(option)}
            className="peer sr-only"
          />
          <span className="inline-flex h-8 items-center rounded-full border px-3 text-sm text-muted-foreground transition-colors select-none peer-checked:border-primary/60 peer-checked:bg-primary/12 peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:text-foreground">
            {option}
          </span>
        </label>
      ))}
    </div>
  );
}

/**
 * Native <select> styled like <Input>: accessible and mobile-friendly. The
 * browser draws the open list, so it's told the colour scheme, and every
 * option and group heading (not only top-level options) gets the popover
 * colours; otherwise grouped options keep the light text on a white list.
 */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none scheme-light focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:scheme-dark",
        "[&_optgroup]:bg-popover [&_optgroup]:text-muted-foreground [&_option]:bg-popover [&_option]:text-popover-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
