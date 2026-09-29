import type { Metadata } from "next";
import { AdminDashboard } from "@/features/dashboard/admin-dashboard";
import { EditorDashboard } from "@/features/dashboard/editor-dashboard";
import { OnboardingDashboard } from "@/features/dashboard/onboarding-dashboard";
import { getAdminDashboard, getEditorDashboard } from "@/features/dashboard/queries";
import { getOnboarding } from "@/features/editors/queries";
import { getSetupProgress } from "@/features/workspaces/queries";
import { isOnboarding, requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser({ allowOnboarding: true });

  if (user.role === "admin") {
    const [data, setup] = await Promise.all([
      getAdminDashboard(user),
      getSetupProgress(await createClient(), user.workspace),
    ]);
    return <AdminDashboard user={user} data={data} setup={setup} />;
  }
  if (isOnboarding(user)) {
    return <OnboardingDashboard user={user} data={await getOnboarding(user)} today={todayIn(user.timezone)} />;
  }
  return <EditorDashboard user={user} data={await getEditorDashboard(user)} />;
}
