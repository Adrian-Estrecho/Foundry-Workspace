import type { Metadata } from "next";
import { AuthCard, AuthTabs } from "../auth-card";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage(props: PageProps<"/signup">) {
  const { next } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  return (
    <AuthCard>
      <AuthTabs active="signup" next={nextPath} />
      <h1 className="mt-6 font-heading text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Then start your own workspace, or join a team with the invitation code they sent you.
      </p>
      <SignUpForm next={nextPath} />
    </AuthCard>
  );
}
