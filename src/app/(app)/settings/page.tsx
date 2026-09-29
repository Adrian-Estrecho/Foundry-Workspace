import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/panel";
import { requireUser } from "@/lib/auth";
import { AppearanceForm } from "./appearance-form";
import { NotificationsForm } from "./notifications-form";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser({ allowOnboarding: true });

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <PageHeader title="Settings" description="Your profile and how ReEdit looks." />
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
    </div>
  );
}
