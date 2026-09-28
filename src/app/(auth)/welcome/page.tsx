import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { firstName } from "@/lib/utils";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Welcome" };

/** Reached from an invite or password-reset email (see /auth/confirm). */
export default async function WelcomePage() {
  const user = await requireUser();

  return (
    <div>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Welcome to Foundry, {firstName(user.full_name)}
      </h1>
      <p className="mt-2 text-muted-foreground">Confirm your name and choose a password to finish setting up.</p>
      <WelcomeForm defaultName={user.full_name} email={user.email} />
    </div>
  );
}
