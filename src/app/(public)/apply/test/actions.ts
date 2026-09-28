"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { renderEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { checkLinkSignature } from "@/lib/form-token";
import { adminEmailContext } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

export type TestEditState = { error?: string; url?: string } | undefined;

const urlSchema = z
  .url({ protocol: /^https?$/, error: "Paste the full link to your edit (https://…)." })
  .max(500);

/**
 * An applicant sends back their test edit from the signed link in their
 * email. `submit_test_edit` records it, moves them to Test Submitted and
 * notifies admins in-app; the admin email goes out after the response.
 */
export async function submitTestEdit(_prev: TestEditState, formData: FormData): Promise<TestEditState> {
  const applicantId = String(formData.get("a") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  if (!checkLinkSignature("test-edit", applicantId, formData.get("s"))) {
    return { error: "This link isn't valid. Use the button in your test-edit email.", url };
  }

  const parsed = urlSchema.safeParse(url);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, url };

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("submit_test_edit", { p_applicant_id: applicantId, p_url: parsed.data });
  if (error) {
    if (error.message.includes("closed")) {
      return { error: "This test edit is closed. If you think that's a mistake, reply to our email.", url };
    }
    console.error("[test-edit] submit failed:", error);
    return { error: "Something went wrong on our side. Please try again in a minute.", url };
  }

  after(async () => {
    const [{ recipients, accent }, { data: applicant }] = await Promise.all([
      adminEmailContext(),
      supabase.from("applicants").select("full_name, email").eq("id", applicantId).maybeSingle(),
    ]);
    if (!applicant) return;
    const email = renderEmail({
      accent,
      heading: `Test edit submitted: ${applicant.full_name}`,
      intro: "Their test edit is in and waiting in Test Submitted.",
      rows: [["Their edit", parsed.data]],
      cta: { label: "Review in Foundry", url: `${env.siteUrl}/editors/applicants/${applicantId}` },
    });
    await sendEmail({ to: recipients, subject: `Test edit submitted: ${applicant.full_name}`, replyTo: applicant.email, ...email });
  });

  redirect("/thanks?form=test");
}
