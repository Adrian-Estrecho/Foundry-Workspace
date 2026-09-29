import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { ClientPipeline } from "@/features/clients/components/client-pipeline";
import { getPipeline } from "@/features/clients/queries";
import { requireAdmin } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const user = await requireAdmin();
  const { clients, editors } = await getPipeline();
  const newLeads = clients.filter((c) => c.column === "new_lead").length;
  const active = clients.filter((c) => c.column === "kickoff" || c.column === "active_client").length;

  return (
    <>
      <RealtimeRefresh channel="clients" tables="clients,client_checklist_items,projects" />
      <PageHeader
        title="Clients"
        description={`${clients.length} in the pipeline · ${newLeads} new ${newLeads === 1 ? "lead" : "leads"} · ${active} active`}
      />
      <ClientPipeline
        clients={clients}
        editors={editors}
        intakeUrl={`${env.siteUrl}/intake/${user.workspace.slug}`}
        today={todayIn(user.timezone)}
      />
    </>
  );
}
