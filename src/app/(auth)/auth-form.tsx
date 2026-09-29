"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { AlertCircleIcon, ArrowBigUpIcon, CheckCircle2Icon, EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FormState } from "./actions";

/**
 * Labelled input used by the auth screens. Password fields get a show/hide
 * button and a Caps Lock warning; `meter` adds a strength meter (new
 * passwords only).
 */
export function Field({
  label,
  hint,
  meter,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; hint?: React.ReactNode; meter?: boolean }) {
  const id = React.useId();
  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {hint}
      </div>
      {props.type === "password" ? (
        <PasswordInput id={id} meter={meter} {...props} />
      ) : (
        <Input id={id} className="h-11 bg-surface" {...props} />
      )}
    </div>
  );
}

function PasswordInput({ meter, ...props }: React.ComponentProps<typeof Input> & { meter?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [visible, setVisible] = React.useState(false);
  const [capsLock, setCapsLock] = React.useState(false);
  const [strength, setStrength] = React.useState<number | null>(null);

  // React resets the form after its action runs; clear the meter with it.
  React.useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const clear = () => setStrength(null);
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  const checkCapsLock = (event: React.KeyboardEvent) => setCapsLock(event.getModifierState("CapsLock"));

  return (
    <>
      <div data-frame className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          className="h-11 bg-surface pr-11"
          onKeyDown={checkCapsLock}
          onKeyUp={checkCapsLock}
          onBlur={() => setCapsLock(false)}
          onInput={(event) => {
            if (meter) setStrength(event.currentTarget.value ? passwordStrength(event.currentTarget.value) : null);
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
      {strength !== null && <StrengthMeter score={strength} />}
      {capsLock && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <ArrowBigUpIcon className="size-3.5" />
          Caps Lock is on
        </p>
      )}
    </>
  );
}

const STRENGTH = [
  { label: "At least 8 characters", tone: "text-danger", bar: "bg-danger" },
  { label: "Weak", tone: "text-danger", bar: "bg-danger" },
  { label: "Fair", tone: "text-warning", bar: "bg-warning" },
  { label: "Good", tone: "text-success", bar: "bg-success" },
  { label: "Strong", tone: "text-success", bar: "bg-success" },
];

/** 0 too short, then 1–4: longer passwords and more kinds of character score higher. */
function passwordStrength(password: string) {
  if (password.length < 8) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((kind) => kind.test(password)).length;
  return Math.min(4, 1 + Number(password.length >= 12) + Number(kinds >= 3) + Number(kinds === 4 || password.length >= 16));
}

function StrengthMeter({ score }: { score: number }) {
  const { label, tone, bar } = STRENGTH[score];
  return (
    <div className="flex items-center gap-3">
      <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className={cn("h-1 rounded-full bg-muted transition-colors", step <= score && bar)} />
        ))}
      </div>
      <span aria-live="polite" className={cn("shrink-0 text-xs", tone)}>
        {label}
      </span>
    </div>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.success) return null;
  const isError = Boolean(state.error);
  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ring-1",
        isError ? "bg-danger/10 text-danger ring-danger/25" : "bg-success/10 text-success ring-success/25",
      )}
    >
      {isError ? <AlertCircleIcon className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />}
      {state.error ?? state.success}
    </p>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending && <Loader2Icon className="animate-spin" />}
      {children}
    </Button>
  );
}

export function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="lg" className="w-full" disabled={pending}>
      {pending ? <Loader2Icon className="animate-spin" /> : <GoogleIcon />}
      Continue with Google
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
