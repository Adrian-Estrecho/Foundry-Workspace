import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SopForm } from "@/features/sops/components/sop-form";
import { getSopForEdit } from "@/features/sops/queries";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit SOP" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditSopPage(props: PageProps<"/sops/[id]/edit">) {
  await requireAdmin();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const sop = await getSopForEdit(id);
  if (!sop) notFound();
  return <SopForm key={sop.updated_at} sop={sop} />;
}
