import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormBuilder } from "@/features/forms/components/form-builder";
import { FORM_NAMES, isFormKind } from "@/features/forms/fields";
import { getWorkspaceForms } from "@/features/forms/queries";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";

export async function generateMetadata(props: PageProps<"/workspace/forms/[kind]">): Promise<Metadata> {
  const { kind } = await props.params;
  return { title: isFormKind(kind) ? FORM_NAMES[kind] : "Forms" };
}

/** Full-screen editor for the application or project request form. */
export default async function FormBuilderPage(props: PageProps<"/workspace/forms/[kind]">) {
  const user = await requireAdmin();
  const { kind } = await props.params;
  if (!isFormKind(kind)) notFound();

  const forms = await getWorkspaceForms();

  return (
    <FormBuilder
      key={kind}
      kind={kind}
      initialFields={forms[kind].fields}
      publicUrl={`${env.siteUrl}/${kind}/${user.workspace.slug}`}
      workspaceName={user.workspace.name}
    />
  );
}
