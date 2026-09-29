"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendEmail, renderEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getBranding } from "@/lib/branding";
import { checkFormToken } from "@/lib/form-token";
import { adminEmailContext, workspaceLink } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

export type IntakeState =
  | { error?: string; fieldErrors?: Partial<Record<keyof z.infer<typeof schema>, string>>; values?: Record<string, string> }
  | undefined;

const optional = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

const schema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(120),
  email: z.email("Enter a valid email address.").max(200),
  company: optional(120),
  phone: optional(40),
  project_type: optional(60),
  budget_range: optional(40),
  deadline: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.iso.date("Pick a valid date.").optional(),
  ),
  reference_links: z.preprocess(
    (v) =>
      String(v ?? "")
        .split(/\s+/)
        .map((line) => line.trim())
        .filter(Boolean),
    z.array(z.url({ protocol: /^https?$/, error: "Reference links must start with http:// or https://" })).max(10, "Add up to 10 links."),
  ),
  notes: optional(4000),
});

/**
 * Public client intake for one workspace (the slug in the link). Spam checks
 * (honeypot + signed timing token bound to the workspace) run first; a failed
 * check pretends to succeed so bots learn nothing. The lead and its pipeline
 * card are created atomically by `submit_intake`, which also notifies the
 * workspace's admins in-app. The admin email goes out after the response.
 */
export async function submitIntake(_prev: IntakeState, formData: FormData): Promise<IntakeState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const values = { ...raw, website: "", token: "" };
  const slug = String(raw.slug ?? "");
  const thanks = `/thanks?form=intake&w=${encodeURIComponent(slug)}`;

  const token = checkFormToken(`intake:${slug}`, raw.token);
  if (raw.website || token === "invalid" || token === "too_fast") {
    redirect(thanks);
  }
  if (token === "expired") {
    return { error: "This page was open for a long time. Please refresh and send it again.", values };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: NonNullable<IntakeState>["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof typeof fieldErrors;
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Please check the highlighted fields.", fieldErrors, values };
  }

  const branding = await getBranding(slug);
  if (!branding) return { error: "This link doesn't work anymore. Ask the studio for a new one.", values };

  const lead = parsed.data;
  const supabase = createAdminClient();
  const { data: clientId, error } = await supabase.rpc("submit_intake", {
    p_workspace_id: branding.workspaceId,
    p_name: lead.name,
    p_email: lead.email,
    p_company: lead.company,
    p_phone: lead.phone,
    p_project_type: lead.project_type,
    p_budget_range: lead.budget_range,
    p_deadline: lead.deadline,
    p_reference_links: lead.reference_links,
    p_notes: lead.notes,
  });

  if (error) {
    if (error.message.includes("rate_limited")) {
      return { error: "We've already received a few requests from you. We'll be in touch soon!", values };
    }
    console.error("[intake] submit failed:", error);
    return { error: "Something went wrong on our side. Please try again in a minute.", values };
  }

  after(async () => {
    const { recipients, accent, companyName } = await adminEmailContext(branding.workspaceId);
    const name = lead.company ?? lead.name;
    const email = renderEmail({
      accent,
      brand: companyName,
      heading: `New lead: ${name}`,
      intro: "A new project enquiry just came in through the intake form. It's waiting in New Lead.",
      rows: [
        ["Name", lead.name],
        ["Company", lead.company],
        ["Email", lead.email],
        ["Phone", lead.phone],
        ["Project type", lead.project_type],
        ["Budget", lead.budget_range],
        ["Deadline", lead.deadline],
        ["References", lead.reference_links.join("\n")],
        ["Notes", lead.notes],
      ],
      cta: { label: "Open in ReEdit", url: workspaceLink(env.siteUrl, branding.workspaceId, `/clients/${clientId}`) },
    });
    await sendEmail({ to: recipients, subject: `New lead: ${name}`, replyTo: lead.email, ...email });
  });

  redirect(thanks);
}
