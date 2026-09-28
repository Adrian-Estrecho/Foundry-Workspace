import type { Json } from "@/types/database";
import { PAYMENT_METHODS, isPaymentMethod } from "../constants";

/** Payment method and its fields, labelled. Used on onboarding and the editor profile. */
export function PaymentSummary({ method, details, className }: { method: string; details: Json; className?: string }) {
  const values = typeof details === "object" && details !== null && !Array.isArray(details) ? details : {};
  const fields = isPaymentMethod(method) ? PAYMENT_METHODS[method].fields : [];

  return (
    <div className={className}>
      <p className="text-sm font-medium">{isPaymentMethod(method) ? PAYMENT_METHODS[method].label : method}</p>
      <dl className="mt-1 grid gap-0.5 text-sm">
        {fields
          .filter((field) => values[field.key])
          .map((field) => (
            <div key={field.key} className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">{field.label}:</dt>
              <dd className="min-w-0 break-words whitespace-pre-line">{String(values[field.key])}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
