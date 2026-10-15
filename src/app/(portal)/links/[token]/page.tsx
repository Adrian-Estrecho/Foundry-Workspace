import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/shared/panel";
import { AccentStyle } from "@/components/theme/accent-style";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { ClientLinks } from "@/features/clients/components/client-links";
import { LinkPortalRefresh } from "@/features/clients/components/link-portal-refresh";
import { linkCounts } from "@/features/clients/links";
import { getLinkPortal } from "@/features/clients/queries";
import { WorkspaceTile } from "@/features/workspaces/components/workspace-switcher";

// The link is a key: keep it out of search engines and other sites' referrer logs.
export async function generateMetadata(props: PageProps<"/links/[token]">): Promise<Metadata> {
  const portal = await getLinkPortal((await props.params).token);
  return {
    title: portal ? `Client links · ${portal.workspace.name}` : "Client links",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

/** Every client's Frame.io and Drive links, for whoever the team shares the private link with. No login. */
export default async function LinkPortalPage(props: PageProps<"/links/[token]">) {
  await connection();
  const { token } = await props.params;
  const portal = await getLinkPortal(token);

  if (!portal) {
    return (
      <section className="mx-auto mt-16 max-w-lg rounded-xl border bg-card p-10 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">This link doesn&apos;t work any more</h1>
        <p className="mt-3 text-muted-foreground">The team may have replaced it with a new one. Ask them for the latest link.</p>
      </section>
    );
  }

  return (
    <>
      <AccentStyle accent={portal.workspace.accent} />
      <LinkPortalRefresh token={token} />

      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <WorkspaceTile name={portal.workspace.name} logoUrl={portal.workspace.logoUrl} className="size-9 text-base" />
          <span className="font-heading text-lg font-semibold tracking-tight">{portal.workspace.name}</span>
        </div>
        <ModeToggle />
      </header>

      <PageHeader title="Client links" description={linkCounts(portal.clients)} />
      <ClientLinks clients={portal.clients} shared />
    </>
  );
}
