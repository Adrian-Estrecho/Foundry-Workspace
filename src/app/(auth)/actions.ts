"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

export type FormState = { error?: string; success?: string; email?: string } | undefined;

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Enter your email and password.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    const message = error.code === "invalid_credentials" ? "Wrong email or password." : error.message;
    return { error: message, email };
  }

  redirect(safeNextPath(parsed.data.next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.email().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${env.siteUrl}/auth/confirm?next=/welcome`,
  });

  // Same answer whether or not the account exists (no account enumeration).
  return { success: "If that email has a Foundry account, a reset link is on its way." };
}

const passwordSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your name.").max(120),
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, { message: "Passwords don't match.", path: ["confirm"] });

/** Used after accepting an invite or opening a password reset link. */
export async function setPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);

  redirect(user.role === "editor" && !(await hasFinishedOnboarding(user.id)) ? "/onboarding" : "/dashboard");
}

async function hasFinishedOnboarding(editorId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("editors").select("onboarding_completed_at").eq("id", editorId).maybeSingle();
  return Boolean(data?.onboarding_completed_at);
}
