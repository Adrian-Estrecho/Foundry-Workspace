import Link from "next/link";
import { CalendarIcon, CheckCircle2Icon, CircleDashedIcon, InboxIcon, WalletIcon } from "lucide-react";
import { daysBetween, formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { stageIndex } from "../constants";
import type { PipelineClient } from "../queries";

/**
 * Pipeline card. The menu (passed in) sits outside the link so there are no
 * nested interactive elements.
 */
export function ClientCard({
  client,
  today,
  menu,
  overlay = false,
}: {
  client: PipelineClient;
  today: string;
  menu?: React.ReactNode;
  overlay?: boolean;
}) {
  const daysInStage = Math.max(0, daysBetween(client.stageChangedAt.slice(0, 10), today));
  const showPayments = stageIndex(client.column) >= stageIndex("contract_signed");

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card transition-colors hover:border-foreground/20",
        overlay && "border-primary/40 bg-popover",
      )}
    >
      <Link href={`/clients/${client.id}`} className="block rounded-xl p-3.5 pr-10 outline-none" draggable={false}>
        <p className="truncate font-medium">{client.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[client.name !== client.contactName && client.contactName, client.projectType].filter(Boolean).join(" · ") || client.email}
        </p>

        {(client.budgetRange || client.deadline) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {client.budgetRange && (
              <span className="inline-flex items-center gap-1 rounded-full bg-background/50 px-2 py-0.5 text-xs ring-1 ring-border">
                <WalletIcon className="size-3" /> {client.budgetRange}
              </span>
            )}
            {client.deadline && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-background/50 px-2 py-0.5 text-xs ring-1 ring-border",
                  client.deadline < today && client.column !== "completed" && "text-danger ring-danger/30",
                )}
              >
                <CalendarIcon className="size-3" /> {formatDay(client.deadline, { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        )}

        {client.checklist && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Onboarding</span>
              <span className="tabular">
                {client.checklist.done}/{client.checklist.total}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div
                className={cn("h-full rounded-full", client.checklist.done === client.checklist.total ? "bg-success" : "bg-primary")}
                style={{ width: `${(client.checklist.done / Math.max(1, client.checklist.total)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {showPayments && (
          <div className="mt-2.5 flex gap-3 text-xs">
            <PaymentFlag label="Deposit" paid={client.depositStatus === "paid"} />
            <PaymentFlag label="Final" paid={client.finalStatus === "paid"} />
          </div>
        )}

        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {client.fromIntake && (
            <span className="inline-flex items-center gap-1 text-status-online">
              <InboxIcon className="size-3" /> Intake ·
            </span>
          )}
          {daysInStage === 0 ? "Moved here today" : `${daysInStage}d in this stage`}
        </p>
      </Link>
      {menu && <div className="absolute top-2 right-2">{menu}</div>}
    </div>
  );
}

function PaymentFlag({ label, paid }: { label: string; paid: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1", paid ? "text-success" : "text-muted-foreground")}>
      {paid ? <CheckCircle2Icon className="size-3.5" /> : <CircleDashedIcon className="size-3.5" />}
      {label} {paid ? "paid" : "unpaid"}
    </span>
  );
}
