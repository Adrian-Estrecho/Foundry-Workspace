import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const LINK_ERRORS: Record<string, string> = {
  link: "That link is invalid or has expired. Ask for a new one.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const linkError = typeof error === "string" ? LINK_ERRORS[error] : undefined;

  return (
    <div>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Welcome to Foundry</h1>
      <p className="mt-2 text-muted-foreground">Sign in with the account your admin set up for you.</p>
      <LoginForm next={nextPath} linkError={linkError} />
    </div>
  );
}
