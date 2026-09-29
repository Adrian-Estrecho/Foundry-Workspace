"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, fieldErrorsOf, optionalText, optionalUrl, type ActionResult as Result } from "@/lib/action-result";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HEX_PATTERN } from "@/lib/theme";
import { SLUG_PATTERN } from "@/features/workspaces/constants";
import { EMAIL_CATEGORIES } from "./email-categories";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const isTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const emptyToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your name.").max(120),
  phone: z.preprocess(emptyToNull, z.string().trim().max(40).nullable()),
  timezone: z.string().refine(isTimeZone, "Pick a valid timezone."),
});

export async function updateProfile(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser({ allowOnboarding: true });
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved" };
}

const appearanceSchema = z.object({
  accent: z.string().regex(HEX_PATTERN).nullable(),
  tint: z.boolean(),
});

/** Saves the user's accent (null = follow the company default). */
export async function updateAppearance(input: { accent: string | null; tint: boolean }): Promise<ActionResult> {
  const user = await requireUser({ allowOnboarding: true });
  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a valid colour." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ accent_color: parsed.data.accent?.toUpperCase() ?? null, tint_background: parsed.data.tint })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Appearance saved" };
}

const emailPreferencesSchema = z.array(z.enum(EMAIL_CATEGORIES.map((c) => c.value))).max(EMAIL_CATEGORIES.length);

/** Settings → Email notifications: the categories the user doesn't want emailed. */
export async function updateEmailPreferences(muted: string[]): Promise<Result> {
  const user = await requireUser({ allowOnboarding: true });
  const parsed = emailPreferencesSchema.safeParse([...new Set(muted)]);
  if (!parsed.success) return fail("Pick from the listed kinds of email.");

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ email_muted: parsed.data }).eq("id", user.id);
  if (error) return fail("Couldn't save your email settings. Try again.");
  revalidatePath("/settings");
  return { ok: true };
}

const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Give the workspace a name.").max(60, "Keep the name under 60 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_PATTERN, "Use 3–40 lowercase letters, numbers or dashes (not at the start or end)."),
  accepting_applications: z.preprocess((value) => value === "on", z.boolean()),
  default_accent: z.string().regex(HEX_PATTERN, "Pick a valid colour."),
  asset_pack_url: optionalUrl(),
  frameio_invite_url: optionalUrl(),
  contract_template_url: optionalUrl(),
  missed_clock_in_grace_minutes: z.coerce.number().int().min(0, "Use 0–720 minutes.").max(720, "Use 0–720 minutes."),
});

const hiringSchema = z.object({
  test_title: optionalText(120),
  test_brief: optionalText(4000),
  test_asset_url: optionalUrl(),
  test_due_days: z.coerce.number().int().min(1, "Between 1 and 30 days.").max(30, "Between 1 and 30 days."),
});

/** Settings → Test edit: the test new editors get when they join. */
export async function updateHiring(formData: FormData): Promise<Result> {
  const user = await requireAdmin();
  const parsed = hiringSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_settings")
    .upsert({ workspace_id: user.workspace.id, ...parsed.data, updated_at: new Date().toISOString() });
  if (error) return fail("Couldn't save the test edit. Try again.");

  revalidatePath("/settings");
  return { ok: true };
}

/** Settings → Workspace (owners and admins). */
export async function updateWorkspace(formData: FormData): Promise<Result> {
  const user = await requireAdmin();
  const parsed = workspaceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ ...parsed.data, default_accent: parsed.data.default_accent.toUpperCase() })
    .eq("id", user.workspace.id);
  if (error?.code === "23505") return fail("That link name is taken.", { slug: "That link name is taken. Try another." });
  if (error?.code === "23514") return fail("That link name isn't allowed.", { slug: "That link name isn't allowed." });
  if (error) return fail("Couldn't save the workspace settings. Try again.");

  revalidatePath("/", "layout");
  return { ok: true };
}
