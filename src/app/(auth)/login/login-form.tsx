"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "../actions";
import { Field, FormMessage, SubmitButton } from "../auth-form";

export function LoginForm({ next, linkError }: { next?: string; linkError?: string }) {
  const [state, action, pending] = useActionState(signIn, linkError ? { error: linkError } : undefined);

  return (
    <form action={action} className="mt-8 grid gap-5">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@foundrymedia.co"
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
      <p className="text-center text-sm text-muted-foreground">
        Want to work with us?{" "}
        <Link href="/apply" className="font-medium text-foreground hover:text-primary">
          Apply as an editor
        </Link>
      </p>
    </form>
  );
}
