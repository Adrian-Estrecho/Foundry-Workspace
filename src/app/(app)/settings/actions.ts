"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HEX_PATTERN } from "@/lib/theme";

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
  const user = await requireUser();
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
  const user = await requireUser();
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

const companySchema = z.object({
  company_name: z.string().trim().min(1, "Enter the company name.").max(120),
  default_accent: z.string().regex(HEX_PATTERN, "Pick a valid colour."),
  admin_email: z.preprocess(emptyToNull, z.email("Enter a valid email.").nullable()),
  asset_pack_url: z.preprocess(emptyToNull, z.url("Enter a full URL (https://…).").nullable()),
  frameio_invite_url: z.preprocess(emptyToNull, z.url("Enter a full URL (https://…).").nullable()),
  contract_template_url: z.preprocess(emptyToNull, z.url("Enter a full URL (https://…).").nullable()),
  missed_clock_in_grace_minutes: z.coerce.number().int().min(0).max(720),
});

export async function updateCompany(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({ ...parsed.data, default_accent: parsed.data.default_accent.toUpperCase() })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Company settings saved" };
}
