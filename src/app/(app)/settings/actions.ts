"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult as Result } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HEX_PATTERN } from "@/lib/theme";
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
