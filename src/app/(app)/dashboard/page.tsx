import type { Metadata } from "next";
import { AdminDashboard } from "@/features/dashboard/admin-dashboard";
import { EditorDashboard } from "@/features/dashboard/editor-dashboard";
import { getAdminDashboard, getEditorDashboard } from "@/features/dashboard/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();

  if (user.role === "admin") {
    return <AdminDashboard user={user} data={await getAdminDashboard(user)} />;
  }
  return <EditorDashboard user={user} data={await getEditorDashboard(user)} />;
}
