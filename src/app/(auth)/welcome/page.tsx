import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { OpenWorkspaceButton } from "@/features/workspaces/components/open-workspace-button";
import { WorkspaceTile } from "@/features/workspaces/components/workspace-switcher";
import { memberLabel } from "@/features/workspaces/constants";
import { getCurrentUser, requireAccount } from "@/lib/auth";
import { env } from "@/lib/env";
import { firstName } from "@/lib/utils";
import { signOut } from "../actions";
import { AuthCard } from "../auth-card";
import { WelcomeOptions } from "./welcome-options";

export const metadata: Metadata = { title: "Welcome" };

/**
 * After sign-up, and whenever someone wants another workspace: pick joining
 * a team (invitation code) or starting your own workspace, then fill that
 * one in a dialog.
 */
export default async function WelcomePage(props: PageProps<"/welcome">) {
  const account = await requireAccount();
  const user = await getCurrentUser();
  const { code } = await props.searchParams;
  const memberships = user?.memberships ?? [];

  return (
    <AuthCard wide>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Welcome, {firstName(account.full_name)}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {memberships.length
          ? "Open one of your workspaces, or add another."
          : "How will you use ReEdit? Pick one to get started."}
      </p>

      {memberships.length > 0 && (
        <section className="mt-6 grid gap-2" aria-labelledby="your-workspaces">
          <h2 id="your-workspaces" className="text-sm font-medium text-muted-foreground">
            Your workspaces
          </h2>
          {memberships.map((m) => (
            <OpenWorkspaceButton key={m.workspace.id} workspaceId={m.workspace.id}>
              <WorkspaceTile name={m.workspace.name} />
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium">{m.workspace.name}</span>
                <span className="block text-xs text-muted-foreground">{memberLabel(m.role, m.status)}</span>
              </span>
              <ArrowRightIcon className="size-4 text-muted-foreground" />
            </OpenWorkspaceButton>
          ))}
        </section>
      )}

      <section className="mt-6 grid gap-2" aria-label="Add a workspace">
        {memberships.length > 0 && <h2 className="text-sm font-medium text-muted-foreground">Add a workspace</h2>}
        <WelcomeOptions
          initialCode={typeof code === "string" ? code : ""}
          accountEmail={account.email}
          host={new URL(env.siteUrl).host}
        />
      </section>

      <form action={signOut} className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
        Signed in as {account.email} ·{" "}
        <button type="submit" className="font-medium text-foreground hover:text-primary">
          Sign out
        </button>
        {memberships.length > 0 && (
          <>
            {" "}
            ·{" "}
            <Link href="/dashboard" className="font-medium text-foreground hover:text-primary">
              Back to my workspace
            </Link>
          </>
        )}
      </form>
    </AuthCard>
  );
}
