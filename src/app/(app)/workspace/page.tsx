import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/panel";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { HiringForm } from "./hiring-form";
import { WorkspaceForm } from "./workspace-form";

export const metadata: Metadata = { title: "Workspace" };

/** Owner and admin settings that apply to everyone in the workspace. */
export default async function WorkspacePage() {
  const user = await requireAdmin();
  const { data: template } = await (await createClient())
    .from("workspace_settings")
    .select("test_title, test_brief, test_asset_url, test_due_days")
    .maybeSingle();

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <PageHeader
        title="Workspace"
        description={`Options for everyone in ${user.workspace.name}. Owners and admins only.`}
      />
      <WorkspaceForm workspace={user.workspace} siteUrl={env.siteUrl} />
      <HiringForm template={template} />
    </div>
  );
}
