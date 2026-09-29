"use client";

import { useActionState } from "react";
import { setPassword } from "../actions";
import { Field, FormMessage, SubmitButton } from "../auth-form";

export function SetPasswordForm({ defaultName, email }: { defaultName: string; email: string }) {
  const [state, action, pending] = useActionState(setPassword, undefined);

  return (
    <form action={action} className="mt-6 grid gap-4">
      {/* Lets password managers save the login against the right email. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field label="Full name" name="fullName" defaultValue={defaultName} autoComplete="name" required />
      <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required meter />
      <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Save and continue</SubmitButton>
    </form>
  );
}
