"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isTimeZone } from "@/lib/action-result";
import { homePath, requireAccount } from "@/lib/auth";
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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    const message =
      error.code === "invalid_credentials"
        ? "Wrong email or password."
        : error.code === "email_not_confirmed"
          ? "Confirm your email first: use the link we sent when you signed up."
          : error.message;
    return { error: message, email };
  }

  redirect(parsed.data.next ? safeNextPath(parsed.data.next) : await homePath(supabase, data.user.id));
}

const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120, "Keep your name under 120 characters."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  timezone: z.string().optional(),
  next: z.string().optional(),
});

/**
 * Creates an account. Supabase emails a confirmation link (see
 * templates/confirmation.html) that signs them in and carries on to `next`,
 * normally the welcome page, or /join when they followed an invitation.
 * The answer is the same whether or not the email already has an account.
 */
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form.", email };

  const next = safeNextPath(parsed.data.next, "/welcome");
  const timezone = parsed.data.timezone && isTimeZone(parsed.data.timezone) ? parsed.data.timezone : "UTC";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.siteUrl}${next}`,
      data: { full_name: parsed.data.fullName, timezone },
    },
  });
  if (error) {
    if (error.code === "weak_password") return { error: "Choose a stronger password.", email };
    if (error.code === "over_email_send_rate_limit") return { error: "Too many sign-ups just now. Try again in a minute.", email };
    return { error: error.message, email };
  }

  // Email confirmation off: they're signed in already.
  if (data.session) redirect(next);
  return { success: `Check your inbox: we sent a link to ${parsed.data.email} to confirm it's you.`, email };
}

/**
 * Sends the visitor to Google, which returns them to /auth/confirm with a
 * PKCE code. A new Google account is created on the way; it lands on the
 * welcome page to create or join a workspace.
 */
export async function signInWithGoogle(formData: FormData) {
  const requested = String(formData.get("next") ?? "");
  // No destination: /auth/confirm picks their dashboard or the welcome page.
  const next = requested ? `?next=${encodeURIComponent(safeNextPath(requested))}` : "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${env.siteUrl}/auth/confirm${next}`,
      queryParams: { prompt: "select_account" },
    },
  });
  redirect(error || !data.url ? "/login?error=google" : data.url);
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
    redirectTo: `${env.siteUrl}/auth/confirm?next=/set-password`,
  });

  // Same answer whether or not the account exists (no account enumeration).
  return { success: "If that email has a ReEdit account, a reset link is on its way." };
}

const passwordSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your name.").max(120),
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, { message: "Passwords don't match.", path: ["confirm"] });

/** Used after opening a password reset link. */
export async function setPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);

  // The dashboard sends people without a workspace on to the welcome page.
  redirect("/dashboard");
}
