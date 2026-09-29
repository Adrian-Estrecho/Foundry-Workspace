import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenIcon, PlusIcon } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { Button } from "@/components/ui/button";
import { SopsStep } from "@/features/editors/components/onboarding/sops-step";
import { SopAdminList } from "@/features/sops/components/sop-admin-list";
import { SOP_CATEGORY_LABEL } from "@/features/sops/constants";
import { getSopAdminList, getSopLibrary } from "@/features/sops/queries";
import { requireUser } from "@/lib/auth";
import { Constants } from "@/types/database";

export const metadata: Metadata = { title: "SOPs" };

/**
 * How the workspace works, by category. Editors (onboarding ones included)
 * read and acknowledge them; required ones are also a step in onboarding.
 * Admins write, edit and publish them, and see who has read each one.
 */
export default async function SopsPage() {
  const user = await requireUser({ allowOnboarding: true });

  if (user.role === "admin") {
    const { sops, teamSize, renderedAt } = await getSopAdminList();
    const categories = Constants.public.Enums.sop_category.filter((category) => sops.some((sop) => sop.category === category));
    return (
      <>
        <RealtimeRefresh channel="sops" tables="sops,sop_acknowledgments" />
        <div className="mx-auto grid max-w-3xl gap-5">
          <PageHeader
            title="SOPs"
            description={`How ${user.workspace.name} works. Required SOPs are part of every new editor's onboarding.`}
            actions={
              <Button asChild>
                <Link href="/sops/new">
                  <PlusIcon /> New SOP
                </Link>
              </Button>
            }
          />
          {categories.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <EmptyState
                icon={BookOpenIcon}
                title="No SOPs yet"
                description="Write down how you work (your editing workflow, review steps, file naming) so every editor does it the same way."
                action={
                  <Button asChild>
                    <Link href="/sops/new">
                      <PlusIcon /> Write the first SOP
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            categories.map((category) => (
              <Panel key={category} title={SOP_CATEGORY_LABEL[category]}>
                <SopAdminList sops={sops.filter((sop) => sop.category === category)} teamSize={teamSize} renderedAt={renderedAt} />
              </Panel>
            ))
          )}
        </div>
      </>
    );
  }

  const { sops, renderedAt } = await getSopLibrary(user);
  const categories = Constants.public.Enums.sop_category.filter((category) => sops.some((sop) => sop.category === category));

  return (
    <>
      <RealtimeRefresh channel="sops" tables="sops,sop_acknowledgments" />
      <div className="mx-auto grid max-w-3xl gap-5">
        <PageHeader title="SOPs" description={`How ${user.workspace.name} works. Mark each one as read once you've been through it.`} />
        {categories.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EmptyState icon={BookOpenIcon} title="No SOPs yet" description="Published SOPs show up here." />
          </div>
        ) : (
          categories.map((category) => (
            <Panel key={category} title={SOP_CATEGORY_LABEL[category]}>
              <SopsStep sops={sops.filter((sop) => sop.category === category)} renderedAt={renderedAt} canAcknowledge />
            </Panel>
          ))
        )}
      </div>
    </>
  );
}
