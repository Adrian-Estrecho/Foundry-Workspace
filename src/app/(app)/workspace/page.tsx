import type { Metadata } from "next";
import { ExternalLinkIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { FORM_KINDS, builtinOf, type FormField, type FormKind } from "@/features/forms/fields";
import { getWorkspaceForms } from "@/features/forms/queries";
import { getProjectStatuses, getTaskStatuses } from "@/features/statuses/queries";
import { workspaceLogoUrl } from "@/features/workspaces/constants";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceSettings, type FormSummary } from "./settings-form";

export const metadata: Metadata = { title: "Workspace" };

const summarize = (kind: FormKind, fields: FormField[], updatedAt: string | null): FormSummary => {
  const questions = fields.filter((f) => f.type !== "section");
  return { questions: questions.length, own: questions.filter((f) => !builtinOf(kind, f.id)).length, updatedAt };
};

/** Owner and admin settings that apply to everyone in the workspace. */
export default async function WorkspacePage() {
  const user = await requireAdmin();
  const [{ data: template }, forms, taskStatuses, projectStatuses] = await Promise.all([
    (await createClient())
      .from("workspace_settings")
      .select("test_title, test_brief, test_asset_url, test_due_days")
      .maybeSingle(),
    getWorkspaceForms(),
    getTaskStatuses(),
    getProjectStatuses(),
  ]);
  const formSummaries = Object.fromEntries(
    FORM_KINDS.map((kind) => [kind, summarize(kind, forms[kind].fields, forms[kind].updatedAt)]),
  ) as Record<FormKind, FormSummary>;

  return (
    <div className="w-full">
      <PageHeader
        title="Workspace"
        description={`Brand, public links, forms and onboarding for everyone in ${user.workspace.name}. Owners and admins only.`}
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
        formSummaries={formSummaries}
        statuses={{ tasks: taskStatuses, projects: projectStatuses }}
      />
    </div>
  );
}
