import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { ClientLinks } from "@/features/clients/components/client-links";
import { ClientViewNav } from "@/features/clients/components/client-view-nav";
import { LinkPortalButton } from "@/features/clients/components/link-portal-button";
import { linkCounts } from "@/features/clients/links";
import { getClientLinks, getLinkPortalSettings } from "@/features/clients/queries";
import { requirePermission } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Client links" };

export default async function ClientLinksPage() {
  const user = await requirePermission("clients.manage");
  const [clients, { portal, renderedAt }] = await Promise.all([
    getClientLinks(await createClient(), user.workspace.id),
    getLinkPortalSettings(user.workspace.id),
  ]);

  return (
    <>
      <RealtimeRefresh channel="client-links" tables="clients,projects,task_attachments,task_comments" />
      <PageHeader
        title="Clients"
        description={linkCounts(clients)}
        actions={<LinkPortalButton portal={portal} siteUrl={env.siteUrl} renderedAt={renderedAt} />}
      />
      <ClientViewNav active="links" />
      <ClientLinks clients={clients} />
    </>
  );
}
