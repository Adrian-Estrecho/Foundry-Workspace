import type { Metadata } from "next";
import { SopForm } from "@/features/sops/components/sop-form";
import { getSopCategories, getSopReaders } from "@/features/sops/queries";
import { workspaceLogoUrl } from "@/features/workspaces/constants";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "New SOP" };

export default async function NewSopPage() {
  const user = await requirePermission("sops.manage");
  const [readers, categories] = await Promise.all([getSopReaders(user), getSopCategories()]);
  return (
    <SopForm
      workspace={{ name: user.workspace.name, logoUrl: workspaceLogoUrl(user.workspace.logo_path) }}
      readers={readers}
      categories={categories}
    />
  );
}
