"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { newLeadEmail } from "@/features/clients/emails";
import { getPublicForm } from "@/features/forms/queries";
import { readSubmission, type PublicFormState } from "@/features/forms/submission";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getBranding } from "@/lib/branding";
import { checkFormToken } from "@/lib/form-token";
import { adminEmailContext, workspaceLink } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

const str = (value: unknown) => (typeof value === "string" ? value : null);
const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);

/**
 * Public client intake for one workspace (the slug in the link), checked
 * against that workspace's form. Spam checks (honeypot + signed timing token
 * bound to the workspace) run first; a failed check pretends to succeed so
 * bots learn nothing. The lead and its pipeline card are created atomically
 * by `submit_intake`, which also notifies the workspace's admins in-app. The
 * admin email goes out after the response.
 */
export async function submitIntake(_prev: PublicFormState, formData: FormData): Promise<PublicFormState> {
  const slug = String(formData.get("slug") ?? "");
  const thanks = `/thanks?form=intake&w=${encodeURIComponent(slug)}`;

  const token = checkFormToken(`intake:${slug}`, String(formData.get("token") ?? ""));
  if (formData.get("website") || token === "invalid" || token === "too_fast") {
    redirect(thanks);
  }

  const branding = await getBranding(slug);
  if (!branding) return { error: "This link doesn't work anymore. Ask the studio for a new one." };

  const fields = await getPublicForm(branding.workspaceId, "intake");
  const { echo, values, answers, fieldErrors } = readSubmission("intake", fields, formData);
  if (token === "expired") {
    return { error: "This page was open for a long time. Please refresh and send it again.", values: echo };
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please check the highlighted fields.", fieldErrors, values: echo };
  }

  const lead = {
    name: str(values.name)!,
    email: str(values.email)!,
    company: str(values.company),
    phone: str(values.phone),
    project_type: str(values.project_type),
    budget_range: str(values.budget_range),
    deadline: str(values.deadline),
    reference_links: list(values.reference_links),
    notes: str(values.notes),
  };
  const supabase = createAdminClient();
  const { data: clientId, error } = await supabase.rpc("submit_intake", {
    p_workspace_id: branding.workspaceId,
    p_name: lead.name,
    p_email: lead.email,
    p_company: lead.company ?? undefined,
    p_phone: lead.phone ?? undefined,
    p_project_type: lead.project_type ?? undefined,
    p_budget_range: lead.budget_range ?? undefined,
    p_deadline: lead.deadline ?? undefined,
    p_reference_links: lead.reference_links,
    p_notes: lead.notes ?? undefined,
    // Only sent when there are any, so a database without custom questions yet still takes the call.
    ...(answers.length > 0 && { p_answers: answers }),
  });

  if (error) {
    if (error.message.includes("rate_limited")) {
      return { error: "We've already received a few requests from you. We'll be in touch soon!", values: echo };
    }
    console.error("[intake] submit failed:", error);
    return { error: "Something went wrong on our side. Please try again in a minute.", values: echo };
  }

  after(async () => {
    const { recipients, accent, companyName } = await adminEmailContext(branding.workspaceId);
    const email = newLeadEmail({
      companyName,
      accent,
      lead,
      answers,
      clientUrl: workspaceLink(env.siteUrl, branding.workspaceId, `/clients/${clientId}`),
    });
    await sendEmail({ to: recipients, replyTo: lead.email, ...email });
  });

  redirect(thanks);
}
