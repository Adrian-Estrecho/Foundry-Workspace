"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, PencilIcon, WalletIcon } from "lucide-react";
import { FormRow, NativeSelect, submitWith } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Json } from "@/types/database";
import { PAYMENT_METHODS, isPaymentMethod, type PaymentMethod } from "../../constants";
import { savePaymentDetails } from "../../onboarding-actions";
import { PaymentSummary } from "../payment-summary";

export function PaymentStep({ payment }: { payment: { method: string; details: Json } | null }) {
  const router = useRouter();
  const saved = payment && isPaymentMethod(payment.method) ? payment : null;
  const [editing, setEditing] = React.useState(!saved);
  const [method, setMethod] = React.useState<PaymentMethod>(saved ? (saved.method as PaymentMethod) : "bank");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const values = saved && saved.method === method && isRecord(saved.details) ? saved.details : {};

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await savePaymentDetails(formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success("Payment details saved");
      setErrors({});
      setEditing(false);
      router.refresh();
    });

  if (!editing && saved) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success ring-1 ring-success/25">
          <WalletIcon className="size-5" />
        </span>
        <PaymentSummary method={saved.method} details={saved.details} className="min-w-0 flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <PencilIcon /> Update
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submitWith(submit)} className="grid gap-4 sm:grid-cols-2">
      <FormRow label="How should we pay you?" error={errors.method} className="sm:col-span-2">
        <NativeSelect name="method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {Object.entries(PAYMENT_METHODS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </FormRow>
      {PAYMENT_METHODS[method].fields.map((field) => (
        <FormRow
          key={`${method}-${field.key}`}
          label={field.label}
          required={field.required}
          error={errors[field.key]}
          className={field.key === "instructions" ? "sm:col-span-2" : undefined}
        >
          {field.key === "instructions" ? (
            <Textarea name={field.key} rows={3} defaultValue={String(values[field.key] ?? "")} className="rounded-xl" />
          ) : (
            <Input
              name={field.key}
              type={field.key === "email" ? "email" : "text"}
              defaultValue={String(values[field.key] ?? "")}
              aria-invalid={!!errors[field.key]}
              autoComplete="off"
            />
          )}
        </FormRow>
      ))}
      <p className="text-xs text-muted-foreground sm:col-span-2">Only you and your workspace&apos;s admins can see these details.</p>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          Save payment details
        </Button>
        {saved && (
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

const isRecord = (value: Json): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
