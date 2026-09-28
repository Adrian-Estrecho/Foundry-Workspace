import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_ACCENT } from "@/lib/theme";

/**
 * Where admin emails go: the company's admin email if one is set in
 * Settings, otherwise every admin's own address. Also returns the company
 * name and accent so emails match the app. Emails to people outside the
 * team (applicants, new editors) use `recipients[0]` as their reply-to.
 */
export async function adminEmailContext() {
  const supabase = createAdminClient();
  const [{ data: settings }, { data: admins }] = await Promise.all([
    supabase.from("app_settings").select("admin_email, default_accent, company_name").eq("id", 1).maybeSingle(),
    supabase.from("profiles").select("email").eq("role", "admin"),
  ]);

  const recipients = settings?.admin_email ? [settings.admin_email] : (admins ?? []).map((a) => a.email);
  return {
    recipients,
    accent: settings?.default_accent ?? DEFAULT_ACCENT,
    companyName: settings?.company_name ?? "Foundry Media",
  };
}
