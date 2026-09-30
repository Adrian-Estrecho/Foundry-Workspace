import type { Metadata } from "next";
import { ExternalLinkIcon } from "lucide-react";
import { WORKSPACE_PERMISSIONS } from "@/components/layout/nav-config";
import { PageHeader } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { FORM_KINDS, builtinOf, type FormField, type FormKind } from "@/features/forms/fields";
import { getWorkspaceForms } from "@/features/forms/queries";
import { workspaceLogoUrl } from "@/features/workspaces/constants";
import { can, requirePermission } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceSettings, type FormSummary } from "./settings-form";

export const metadata: Metadata = { title: "Workspace" };

const summarize = (kind: FormKind, fields: FormField[], updatedAt: string | null): FormSummary => {
  const questions = fields.filter((f) => f.type !== "section");
  return { questions: questions.length, own: questions.filter((f) => !builtinOf(kind, f.id)).length, updatedAt };
};

/**
 * Settings that apply to everyone in the workspace. Owners and admins see all
 * of it; people given a workspace ability see just their sections.
 */
export default async function WorkspacePage() {
  const user = await requirePermission(...WORKSPACE_PERMISSIONS);
  const sections = {
    brand: can(user, "workspace.brand"),
    forms: can(user, "workspace.forms"),
    contract: can(user, "workspace.contract"),
    links: can(user, "workspace.links"),
    hiring: can(user, "editors.manage"),
    integrations: user.role === "admin",
  };
  const supabase = await createClient();
  const [{ data: template }, forms, { data: clickup }] = await Promise.all([
    supabase.from("workspace_settings").select("test_title, test_brief, test_asset_url, test_due_days").maybeSingle(),
    getWorkspaceForms(),
    supabase.from("clickup_connections").select("team_name, pipelines:clickup_pipelines(count)").maybeSingle(),
  ]);
  const formSummaries = Object.fromEntries(
    FORM_KINDS.map((kind) => [kind, summarize(kind, forms[kind].fields, forms[kind].updatedAt)]),
  ) as Record<FormKind, FormSummary>;

  return (
    <div className="w-full">
      <PageHeader
        title="Workspace"
        description={
          user.role === "admin"
            ? `Brand, public links, forms and onboarding for everyone in ${user.workspace.name}. Owners and admins only.`
            : `The ${user.workspace.name} settings you've been given access to.`
        }
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
        sections={sections}
        template={template}
        logoUrl={workspaceLogoUrl(user.workspace.logo_path)}
        siteUrl={env.siteUrl}
        formSummaries={formSummaries}
        clickup={clickup ? { teamName: clickup.team_name, pipelines: clickup.pipelines[0]?.count ?? 0 } : null}
      />
    </div>
  );
}
