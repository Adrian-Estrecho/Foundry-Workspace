import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/panel";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ACCENT } from "@/lib/theme";
import { AppearanceForm } from "./appearance-form";
import { CompanyForm } from "./company-form";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <PageHeader title="Settings" description="Your profile, how Foundry looks, and company-wide options." />
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
        companyAccent={settings?.default_accent ?? DEFAULT_ACCENT}
      />
      {user.role === "admin" && settings && <CompanyForm settings={settings} />}
    </div>
  );
}
