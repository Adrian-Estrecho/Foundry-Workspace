"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requestPasswordReset } from "../actions";
import { Field, FormMessage, SubmitButton } from "../auth-form";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <div>
      <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Back to sign in
      </Link>
      <h1 className="mt-6 font-heading text-3xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-2 text-muted-foreground">We&apos;ll email you a link to choose a new one.</p>
      <form action={action} className="mt-8 grid gap-5">
        <Field label="Email" name="email" type="email" autoComplete="email" required autoFocus />
        <FormMessage state={state} />
        <SubmitButton pending={pending}>Send reset link</SubmitButton>
      </form>
    </div>
  );
}
