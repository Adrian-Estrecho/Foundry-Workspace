import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/panel";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { AppearanceForm } from "./appearance-form";
import { HiringForm } from "./hiring-form";
import { NotificationsForm } from "./notifications-form";
import { ProfileForm } from "./profile-form";
import { WorkspaceForm } from "./workspace-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser({ allowOnboarding: true });
  const template =
    user.role === "admin"
      ? (
          await (await createClient())
            .from("workspace_settings")
            .select("test_title, test_brief, test_asset_url, test_due_days")
            .maybeSingle()
        ).data
      : null;

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <PageHeader
        title="Settings"
        description={
          user.role === "admin"
            ? `Your profile, how ReEdit looks, and options for ${user.workspace.name}.`
            : "Your profile and how ReEdit looks."
        }
      />
      <ProfileForm
        fullName={user.full_name}
        email={user.email}
        phone={user.phone}
        timezone={user.timezone}
        timeZones={Intl.supportedValuesOf("timeZone")}
      />
      <AppearanceForm
        savedAccent={user.accent_color}
        savedTint={user.tint_background}
        companyAccent={user.workspace.default_accent}
      />
      <NotificationsForm muted={user.email_muted} role={user.role} />
      {user.role === "admin" && (
        <>
          <WorkspaceForm workspace={user.workspace} siteUrl={env.siteUrl} />
          <HiringForm template={template} />
        </>
      )}
    </div>
  );
}
