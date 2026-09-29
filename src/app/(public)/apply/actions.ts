"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { getBranding } from "@/lib/branding";
import { newApplicantEmail } from "@/features/applicants/emails";
import { getPublicForm } from "@/features/forms/queries";
import { readSubmission, type PublicFormState } from "@/features/forms/submission";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { checkFormToken } from "@/lib/form-token";
import { adminEmailContext, workspaceLink } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

const str = (value: unknown) => (typeof value === "string" ? value : null);
const num = (value: unknown) => (typeof value === "number" ? value : null);
const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);

/**
 * Public editor application for one workspace (the slug in the link),
 * checked against that workspace's form. Same spam checks as the client
 * intake (honeypot + signed timing token bound to the workspace, failures
 * pretend to succeed). The applicant card is created by
 * `submit_application`, which also notifies the workspace's admins in-app;
 * the admin email goes out after the response.
 */
export async function submitApplication(_prev: PublicFormState, formData: FormData): Promise<PublicFormState> {
  const slug = String(formData.get("slug") ?? "");
  const thanks = `/thanks?form=apply&w=${encodeURIComponent(slug)}`;

  const token = checkFormToken(`apply:${slug}`, String(formData.get("token") ?? ""));
  if (formData.get("website") || token === "invalid" || token === "too_fast") {
    redirect(thanks);
  }

  const branding = await getBranding(slug);
  if (!branding) return { error: "This application link doesn't work anymore. Ask the team for a new one." };

  const fields = await getPublicForm(branding.workspaceId, "apply");
  const { echo, values, answers, fieldErrors } = readSubmission("apply", fields, formData);
  if (token === "expired") {
    return { error: "This page was open for a long time. Please refresh and send it again.", values: echo };
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please check the highlighted fields.", fieldErrors, values: echo };
  }

  const application = {
    full_name: str(values.full_name)!,
    email: str(values.email)!,
    portfolio_url: str(values.portfolio_url),
    software: list(values.software),
    specialties: list(values.specialties),
    timezone: str(values.timezone),
    hourly_rate: num(values.hourly_rate),
    weekly_hours: num(values.weekly_hours),
    availability_notes: str(values.availability_notes),
  };
  const supabase = createAdminClient();
  const { data: applicantId, error } = await supabase.rpc("submit_application", {
    p_workspace_id: branding.workspaceId,
    p_full_name: application.full_name,
    p_email: application.email,
    p_portfolio_url: application.portfolio_url ?? undefined,
    p_software: application.software,
    p_specialties: application.specialties,
    p_timezone: application.timezone ?? undefined,
    p_hourly_rate: application.hourly_rate ?? undefined,
    p_weekly_hours: application.weekly_hours ?? undefined,
    p_availability_notes: application.availability_notes ?? undefined,
    // Only sent when there are any, so a database without custom questions yet still takes the call.
    ...(answers.length > 0 && { p_answers: answers }),
  });

  if (error) {
    if (error.message.includes("duplicate")) {
      return { error: "We already have a recent application from this email. We'll be in touch!", values: echo };
    }
    if (error.message.includes("closed")) {
      return { error: `${branding.name} isn't taking applications right now.`, values: echo };
    }
    if (error.message.includes("rate_limited")) {
      return { error: "We're getting a lot of applications right now. Please try again in a few minutes.", values: echo };
    }
    console.error("[apply] submit failed:", error);
    return { error: "Something went wrong on our side. Please try again in a minute.", values: echo };
  }

  after(async () => {
    const { recipients, accent, companyName } = await adminEmailContext(branding.workspaceId);
    const email = newApplicantEmail({
      companyName,
      accent,
      applicant: application,
      answers,
      reviewUrl: workspaceLink(env.siteUrl, branding.workspaceId, `/editors/applicants/${applicantId}`),
    });
    await sendEmail({ to: recipients, replyTo: application.email, ...email });
  });

  redirect(thanks);
}
