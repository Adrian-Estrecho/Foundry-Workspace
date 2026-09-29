import type { Metadata } from "next";
import { SopForm } from "@/features/sops/components/sop-form";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "New SOP" };

export default async function NewSopPage() {
  await requireAdmin();
  return <SopForm />;
}
