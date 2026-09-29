"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SOFTWARE_OPTIONS, SPECIALTY_OPTIONS } from "@/features/applicants/constants";
import { isTimeZone } from "@/lib/action-result";
import { getBranding } from "@/lib/branding";
import { newApplicantEmail } from "@/features/applicants/emails";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { checkFormToken } from "@/lib/form-token";
import { adminEmailContext, workspaceLink } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

type Values = Record<string, string | string[]>;

export type ApplyState =
  | { error?: string; fieldErrors?: Partial<Record<keyof z.infer<typeof schema>, string>>; values?: Values }
  | undefined;

const schema = z.object({
  full_name: z.string().trim().min(2, "Tell us your name.").max(120),
  email: z.email("Enter a valid email address.").max(200),
  portfolio_url: z.url({ protocol: /^https?$/, error: "Add a link to your portfolio or reel (https://…)." }).max(500),
  software: z.array(z.enum(SOFTWARE_OPTIONS)).min(1, "Pick at least one."),
  specialties: z.array(z.enum(SPECIALTY_OPTIONS)),
  timezone: z.string().refine(isTimeZone, "Pick your timezone."),
  hourly_rate: z.coerce.number().min(1, "Enter your hourly rate in USD.").max(1000, "That rate looks too high."),
  weekly_hours: z.coerce
    .number()
    .int("Use whole hours.")
    .min(1, "How many hours a week can you work?")
    .max(80, "Up to 80 hours a week."),
  availability_notes: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(2000).optional(),
  ),
});

/**
 * Public editor application for one workspace (the slug in the link). Same
 * spam checks as the client intake (honeypot + signed timing token bound to
 * the workspace, failures pretend to succeed). The applicant card is created
 * by `submit_application`, which also notifies the workspace's admins
 * in-app; the admin email goes out after the response.
 */
export async function submitApplication(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const multi = { software: formData.getAll("software").map(String), specialties: formData.getAll("specialties").map(String) };
  const values: Values = { ...raw, ...multi, website: "", token: "" };
  const slug = String(raw.slug ?? "");
  const thanks = `/thanks?form=apply&w=${encodeURIComponent(slug)}`;

  const token = checkFormToken(`apply:${slug}`, raw.token);
  if (raw.website || token === "invalid" || token === "too_fast") {
    redirect(thanks);
  }
  if (token === "expired") {
    return { error: "This page was open for a long time. Please refresh and send it again.", values };
  }

  const parsed = schema.safeParse({ ...raw, ...multi });
  if (!parsed.success) {
    const fieldErrors: NonNullable<ApplyState>["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof typeof fieldErrors;
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Please check the highlighted fields.", fieldErrors, values };
  }

  const branding = await getBranding(slug);
  if (!branding) return { error: "This application link doesn't work anymore. Ask the team for a new one.", values };

  const application = parsed.data;
  const supabase = createAdminClient();
  const { data: applicantId, error } = await supabase.rpc("submit_application", {
    p_workspace_id: branding.workspaceId,
    p_full_name: application.full_name,
    p_email: application.email,
    p_portfolio_url: application.portfolio_url,
    p_software: application.software,
    p_specialties: application.specialties,
    p_timezone: application.timezone,
    p_hourly_rate: application.hourly_rate,
    p_weekly_hours: application.weekly_hours,
    p_availability_notes: application.availability_notes,
  });

  if (error) {
    if (error.message.includes("duplicate")) {
      return { error: "We already have a recent application from this email. We'll be in touch!", values };
    }
    if (error.message.includes("closed")) {
      return { error: `${branding.name} isn't taking applications right now.`, values };
    }
    if (error.message.includes("rate_limited")) {
      return { error: "We're getting a lot of applications right now. Please try again in a few minutes.", values };
    }
    console.error("[apply] submit failed:", error);
    return { error: "Something went wrong on our side. Please try again in a minute.", values };
  }

  after(async () => {
    const { recipients, accent, companyName } = await adminEmailContext(branding.workspaceId);
    const email = newApplicantEmail({
      companyName,
      accent,
      applicant: application,
      reviewUrl: workspaceLink(env.siteUrl, branding.workspaceId, `/editors/applicants/${applicantId}`),
    });
    await sendEmail({ to: recipients, replyTo: application.email, ...email });
  });

  redirect(thanks);
}
