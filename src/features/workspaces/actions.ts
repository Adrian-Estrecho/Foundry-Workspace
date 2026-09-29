"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { requireAccount } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { adminEmailContext, workspaceLink } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";
import { SLUG_PATTERN } from "./constants";
import { workspaceWelcomeEmail } from "./emails";

/** Makes another of the user's workspaces the active one, then opens it. */
export async function switchWorkspace(workspaceId: string, next?: string): Promise<ActionResult> {
  await requireAccount();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_active_workspace", { p_workspace_id: workspaceId });
  if (error) return fail("You're no longer a member of that workspace.");

  revalidatePath("/", "layout");
  redirect(safeNextPath(next));
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Give your workspace a name.").max(60, "Keep the name under 60 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_PATTERN, "Use 3–40 lowercase letters, numbers or dashes (not at the start or end)."),
});

export type CreateWorkspaceState = { error?: string; fieldErrors?: Record<string, string>; values?: { name: string; slug: string } } | undefined;

const CREATE_ERRORS: Record<string, [field: "name" | "slug" | null, message: string]> = {
  slug_taken: ["slug", "That link is taken. Try another."],
  invalid_slug: ["slug", "That link isn't available. Try another."],
  invalid_name: ["name", "Give your workspace a name (2–60 characters)."],
  limit_reached: [null, "You already own five workspaces, which is the limit for now."],
};

/** Creates a workspace owned by the user and switches to it. */
export async function createWorkspace(_prev: CreateWorkspaceState, formData: FormData): Promise<CreateWorkspaceState> {
  const account = await requireAccount();
  const values = { name: String(formData.get("name") ?? ""), slug: String(formData.get("slug") ?? "") };
  const parsed = createSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: workspaceId, error } = await supabase.rpc("create_workspace", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });
  if (error) {
    const known = CREATE_ERRORS[error.message];
    if (!known) return { error: "Couldn't create the workspace. Try again.", values };
    const [field, message] = known;
    return field ? { fieldErrors: { [field]: message }, values } : { error: message, values };
  }

  after(async () => {
    const { accent } = await adminEmailContext(workspaceId);
    const email = workspaceWelcomeEmail({
      name: parsed.data.name,
      ownerName: account.full_name,
      accent,
      intakeUrl: `${env.siteUrl}/intake/${parsed.data.slug}`,
      applyUrl: `${env.siteUrl}/apply/${parsed.data.slug}`,
      dashboardUrl: workspaceLink(env.siteUrl, workspaceId, "/dashboard"),
      timeZone: account.timezone,
    });
    await sendEmail({ to: account.email, ...email });
  });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
