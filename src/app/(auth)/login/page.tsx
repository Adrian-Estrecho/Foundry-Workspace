import type { Metadata } from "next";
import { AuthCard, AuthTabs } from "../auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const LINK_ERRORS: Record<string, string> = {
  link: "That link is invalid or has expired. Ask for a new one.",
  google: "Google sign-in didn't finish. Try again, or use your email and password.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const linkError = typeof error === "string" ? LINK_ERRORS[error] : undefined;
  const invited = nextPath?.startsWith("/join");

  return (
    <AuthCard>
      <AuthTabs active="login" next={nextPath} />
      <h1 className="mt-6 font-heading text-2xl font-semibold tracking-tight">
        {invited ? "Accept your invitation" : "Welcome back"}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {invited
          ? "Sign in, or create a free account, to join the team that invited you."
          : "Sign in to your workspace, or to join a team you've been invited to."}
      </p>
      <LoginForm next={nextPath} linkError={linkError} />
    </AuthCard>
  );
}
