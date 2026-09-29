"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, signInWithGoogle } from "../actions";
import { Field, FormMessage, GoogleButton, SubmitButton } from "../auth-form";

export function LoginForm({ next, linkError }: { next?: string; linkError?: string }) {
  const [state, action, pending] = useActionState(signIn, linkError ? { error: linkError } : undefined);

  return (
    <div className="mt-6 grid gap-4">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? ""} />
        <GoogleButton />
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={action} className="grid gap-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          defaultValue={state?.email}
          required
          autoFocus
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          hint={
            <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-primary">
              Forgot password?
            </Link>
          }
        />
        <FormMessage state={state} />
        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>
    </div>
  );
}
