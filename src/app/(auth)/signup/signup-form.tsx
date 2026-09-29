"use client";

import * as React from "react";
import { useActionState } from "react";
import { signInWithGoogle, signUp } from "../actions";
import { Field, FormMessage, GoogleButton, SubmitButton } from "../auth-form";

const noopSubscribe = () => () => {};

export function SignUpForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signUp, undefined);
  // Their timezone, only known in the browser.
  const timezone = React.useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );

  if (state?.success) {
    return (
      <div className="mt-6">
        <FormMessage state={state} />
        <p className="mt-4 text-sm text-muted-foreground">
          The link signs you in and takes you straight on. Nothing there? Check spam, or sign up again in a minute.
        </p>
      </div>
    );
  }

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
        <input type="hidden" name="timezone" value={timezone} />
        <Field label="Full name" name="fullName" autoComplete="name" required autoFocus />
        <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.email} required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          meter
        />
        <FormMessage state={state} />
        <SubmitButton pending={pending}>Create account</SubmitButton>
      </form>
    </div>
  );
}
