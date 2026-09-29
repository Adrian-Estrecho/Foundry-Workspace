import type { Metadata } from "next";
import { ExternalLinkIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { workspaceLogoUrl } from "@/features/workspaces/constants";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceSettings } from "./settings-form";

export const metadata: Metadata = { title: "Workspace" };

/** Owner and admin settings that apply to everyone in the workspace. */
export default async function WorkspacePage() {
  const user = await requireAdmin();
  const { data: template } = await (await createClient())
    .from("workspace_settings")
    .select("test_title, test_brief, test_asset_url, test_due_days")
    .maybeSingle();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Workspace"
        description={`Brand, public links and onboarding for everyone in ${user.workspace.name}. Owners and admins only.`}
        actions={
          <Button asChild variant="outline">
            <a href={`/apply/${user.workspace.slug}`} target="_blank" rel="noreferrer">
              View application page <ExternalLinkIcon />
            </a>
          </Button>
        }
      />
      <WorkspaceSettings
        workspace={user.workspace}
        template={template}
        logoUrl={workspaceLogoUrl(user.workspace.logo_path)}
        siteUrl={env.siteUrl}
      />
    </div>
  );
}
