"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircleIcon, ArrowRightIcon, Loader2Icon } from "lucide-react";
import { CheckboxChips, FieldGroup, FormRow, NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SOFTWARE_OPTIONS, SPECIALTY_OPTIONS } from "@/features/applicants/constants";
import { submitApplication, type ApplyState } from "./actions";

const noopSubscribe = () => () => {};

export function ApplyForm({ slug, token, timeZones }: { slug: string; token: string; timeZones: string[] }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(submitApplication, undefined);
  const errors = state?.fieldErrors ?? {};
  const value = (name: string) => {
    const v = state?.values?.[name];
    return typeof v === "string" ? v : "";
  };
  const list = (name: string) => {
    const v = state?.values?.[name];
    return Array.isArray(v) ? v : [];
  };
  // Pre-select the visitor's own timezone (only known in the browser).
  const detectedZone = React.useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );
  const zone = value("timezone") || detectedZone;
  const zones = !zone || timeZones.includes(zone) ? timeZones : [zone, ...timeZones];
  // Re-mount the fields with the submitted values after a failed attempt.
  const formKey = state ? JSON.stringify(state.values) : "initial";

  return (
    <form key={formKey} action={action} className="grid gap-8 rounded-xl border bg-card p-6 sm:p-8" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="token" value={token} />
      {/* Honeypot: invisible to people, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 font-heading text-lg font-medium">About you</legend>
        <FormRow label="Full name" required error={errors.full_name}>
          <Input name="full_name" autoComplete="name" defaultValue={value("full_name")} aria-invalid={!!errors.full_name} required />
        </FormRow>
        <FormRow label="Email" required error={errors.email}>
          <Input name="email" type="email" autoComplete="email" defaultValue={value("email")} aria-invalid={!!errors.email} required />
        </FormRow>
        <FormRow label="Portfolio or reel" required hint="Vimeo, YouTube, your site or a Drive folder." error={errors.portfolio_url}>
          <Input
            name="portfolio_url"
            type="url"
            placeholder="https://"
            defaultValue={value("portfolio_url")}
            aria-invalid={!!errors.portfolio_url}
            required
          />
        </FormRow>
        <FormRow label="Timezone" required error={errors.timezone}>
          <NativeSelect key={zone} name="timezone" defaultValue={zone} aria-invalid={!!errors.timezone} required>
            {!zone && <option value="">Choose your timezone</option>}
            {zones.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </NativeSelect>
        </FormRow>
      </fieldset>

      <fieldset className="grid gap-6">
        <legend className="mb-4 font-heading text-lg font-medium">Your work</legend>
        <FieldGroup label="Software you edit in" required error={errors.software}>
          <CheckboxChips name="software" options={SOFTWARE_OPTIONS} defaultValue={list("software")} />
        </FieldGroup>
        <FieldGroup label="What you're best at" hint="Pick as many as fit." error={errors.specialties}>
          <CheckboxChips name="specialties" options={SPECIALTY_OPTIONS} defaultValue={list("specialties")} />
        </FieldGroup>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 font-heading text-lg font-medium">Rate and availability</legend>
        <FormRow label="Hourly rate (USD)" required error={errors.hourly_rate}>
          <Input
            name="hourly_rate"
            type="number"
            inputMode="decimal"
            min={1}
            step="0.5"
            placeholder="25"
            defaultValue={value("hourly_rate")}
            aria-invalid={!!errors.hourly_rate}
            required
          />
        </FormRow>
        <FormRow label="Hours per week" required error={errors.weekly_hours}>
          <Input
            name="weekly_hours"
            type="number"
            inputMode="numeric"
            min={1}
            max={80}
            placeholder="30"
            defaultValue={value("weekly_hours")}
            aria-invalid={!!errors.weekly_hours}
            required
          />
        </FormRow>
        <FormRow label="Availability" hint="Usual working hours, start date, anything we should know." error={errors.availability_notes} className="sm:col-span-2">
          <Textarea name="availability_notes" rows={3} defaultValue={value("availability_notes")} className="rounded-xl" />
        </FormRow>
      </fieldset>

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
          Send application
        </Button>
      </div>
    </form>
  );
}
