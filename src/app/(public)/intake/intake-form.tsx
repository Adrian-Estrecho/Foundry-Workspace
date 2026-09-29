"use client";

import { useActionState } from "react";
import { AlertCircleIcon, ArrowRightIcon, Loader2Icon } from "lucide-react";
import { FormRow, NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BUDGET_RANGES, PROJECT_TYPES } from "@/features/clients/constants";
import { submitIntake, type IntakeState } from "./actions";

export function IntakeForm({ slug, token }: { slug: string; token: string }) {
  const [state, action, pending] = useActionState<IntakeState, FormData>(submitIntake, undefined);
  const errors = state?.fieldErrors ?? {};
  const value = (name: string) => state?.values?.[name] ?? "";
  // Re-mount the fields with the submitted values after a failed attempt.
  const formKey = state ? JSON.stringify(state.values) : "initial";

  return (
    <form key={formKey} action={action} className="grid gap-6 rounded-xl border bg-card p-6 sm:p-8" noValidate>
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
        <FormRow label="Your name" required error={errors.name}>
          <Input name="name" autoComplete="name" defaultValue={value("name")} aria-invalid={!!errors.name} required />
        </FormRow>
        <FormRow label="Company" error={errors.company}>
          <Input name="company" autoComplete="organization" defaultValue={value("company")} />
        </FormRow>
        <FormRow label="Email" required error={errors.email}>
          <Input name="email" type="email" autoComplete="email" defaultValue={value("email")} aria-invalid={!!errors.email} required />
        </FormRow>
        <FormRow label="Phone" error={errors.phone}>
          <Input name="phone" type="tel" autoComplete="tel" defaultValue={value("phone")} />
        </FormRow>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 font-heading text-lg font-medium">Your project</legend>
        <FormRow label="Project type" error={errors.project_type}>
          <NativeSelect name="project_type" defaultValue={value("project_type")}>
            <option value="">Choose one</option>
            {PROJECT_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </NativeSelect>
        </FormRow>
        <FormRow label="Budget" error={errors.budget_range}>
          <NativeSelect name="budget_range" defaultValue={value("budget_range")}>
            <option value="">Choose a range</option>
            {BUDGET_RANGES.map((range) => (
              <option key={range}>{range}</option>
            ))}
          </NativeSelect>
        </FormRow>
        <FormRow label="Deadline" hint="When do you need the first delivery?" error={errors.deadline}>
          <Input name="deadline" type="date" defaultValue={value("deadline")} aria-invalid={!!errors.deadline} />
        </FormRow>
        <FormRow
          label="Reference links"
          hint="Videos you like, your channel, brand guidelines. One per line."
          error={errors.reference_links}
          className="sm:row-span-2"
        >
          <Textarea
            name="reference_links"
            rows={4}
            placeholder={"https://youtube.com/…\nhttps://instagram.com/…"}
            defaultValue={value("reference_links")}
            aria-invalid={!!errors.reference_links}
            className="rounded-xl"
          />
        </FormRow>
        <FormRow label="Anything else?" error={errors.notes} className="sm:col-span-2">
          <Textarea
            name="notes"
            rows={4}
            placeholder="Goals, number of videos, style, platforms…"
            defaultValue={value("notes")}
            className="rounded-xl"
          />
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
          Send project details
        </Button>
      </div>
    </form>
  );
}
