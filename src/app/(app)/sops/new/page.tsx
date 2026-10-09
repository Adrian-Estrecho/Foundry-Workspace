import type { Metadata } from "next";
import { SopForm } from "@/features/sops/components/sop-form";
import { workspaceLogoUrl } from "@/features/workspaces/constants";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "New SOP" };

export default async function NewSopPage() {
  const user = await requirePermission("sops.manage");
  return <SopForm workspace={{ name: user.workspace.name, logoUrl: workspaceLogoUrl(user.workspace.logo_path) }} />;
}
