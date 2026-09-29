"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircleIcon, ArrowRightIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FormField, FormKind } from "../fields";
import type { PublicFormState } from "../submission";
import { FormFields } from "./form-fields";

const noopSubscribe = () => () => {};

/**
 * A workspace's public form (application or project request), drawn from
 * its field list. Spam protection rides along: the signed timing token and
 * a honeypot field people never see.
 */
export function PublicForm({
  kind,
  slug,
  token,
  fields,
  timeZones,
  submitLabel,
  action,
}: {
  kind: FormKind;
  slug: string;
  token: string;
  fields: FormField[];
  timeZones: string[];
  submitLabel: string;
  action: (state: PublicFormState, formData: FormData) => Promise<PublicFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  // Pre-select the visitor's own timezone (only known in the browser).
  const detectedZone = React.useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );
  const values = { ...state?.values };
  for (const field of fields) {
    if (field.type === "timezone" && !values[field.id] && detectedZone) values[field.id] = detectedZone;
  }
  // Re-mount the fields with the submitted values after a failed attempt.
  const formKey = state ? JSON.stringify(state.values) : "initial";

  return (
    <form key={formKey} action={formAction} className="@container grid gap-8 rounded-xl border bg-card p-6 sm:p-8" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="token" value={token} />
      {/* Honeypot: invisible to people, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <FormFields kind={kind} fields={fields} values={values} errors={state?.fieldErrors} timeZones={timeZones} />

      {state?.error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger ring-1 ring-danger/25">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          <span className="text-primary">*</span> Required
        </p>
        <Button type="submit" size="lg" disabled={pending} className="min-w-48">
          {pending ? <Loader2Icon className="animate-spin" /> : <ArrowRightIcon />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
