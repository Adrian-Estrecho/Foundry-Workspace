import type { Metadata } from "next";
import { requireAccount } from "@/lib/auth";
import { firstName } from "@/lib/utils";
import { AuthCard } from "../auth-card";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Choose a password" };

/** Reached from a password-reset email (see /auth/confirm). */
export default async function SetPasswordPage() {
  const user = await requireAccount();

  return (
    <AuthCard>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Hi {firstName(user.full_name)}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Confirm your name and choose a new password.</p>
      <SetPasswordForm defaultName={user.full_name} email={user.email} />
    </AuthCard>
  );
}
