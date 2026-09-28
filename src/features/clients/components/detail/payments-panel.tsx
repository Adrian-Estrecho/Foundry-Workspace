"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Panel } from "@/components/shared/panel";
import { Segmented } from "@/components/shared/segmented";
import type { Enums } from "@/types/database";
import { setPaymentStatus } from "../../actions";

type Status = Enums<"payment_status">;

export function PaymentsPanel({ clientId, deposit, final }: { clientId: string; deposit: Status; final: Status }) {
  const router = useRouter();
  const [values, setValues] = React.useOptimistic({ deposit, final }, (current, next: Partial<{ deposit: Status; final: Status }>) => ({
    ...current,
    ...next,
  }));
  const [, startTransition] = React.useTransition();

  const change = (field: "deposit" | "final", status: Status) =>
    startTransition(async () => {
      setValues({ [field]: status });
      const result = await setPaymentStatus(clientId, field === "deposit" ? "deposit_status" : "final_status", status);
      if (!result.ok) toast.error(result.error);
      else toast.success(`${field === "deposit" ? "Deposit" : "Final payment"} marked ${status}`);
      router.refresh();
    });

  const options: { value: Status; label: string }[] = [
    { value: "unpaid", label: "Unpaid" },
    { value: "paid", label: "Paid" },
  ];

  return (
    <Panel title="Payments">
      <div className="grid gap-3">
        {(["deposit", "final"] as const).map((field) => (
          <div key={field} className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border">
            <div>
              <p className="text-sm font-medium">{field === "deposit" ? "Deposit" : "Final payment"}</p>
              <p className={values[field] === "paid" ? "text-xs text-success" : "text-xs text-muted-foreground"}>
                {values[field] === "paid" ? "Received" : "Not received yet"}
              </p>
            </div>
            <Segmented
              label={field === "deposit" ? "Deposit status" : "Final payment status"}
              value={values[field]}
              onChange={(status) => change(field, status)}
              options={options}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}
