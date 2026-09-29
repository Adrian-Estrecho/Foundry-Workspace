"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, fieldErrorsOf, optionalText, type ActionResult } from "@/lib/action-result";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DOC_TYPES, PAYMENT_METHODS, SELF_REPORTED_STEPS, isPaymentMethod } from "./constants";

/**
 * Onboarding actions are for editors, acting on their own records in their
 * current workspace. Editors still onboarding may use them (that's the point).
 */
async function requireEditor(): Promise<CurrentUser> {
  const user = await requireUser({ allowOnboarding: true });
  if (user.role !== "editor") throw new Error("Only editors have onboarding.");
  return user;
}

function revalidateOnboarding(editorId: string) {
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/sops");
  revalidatePath(`/editors/${editorId}`);
}

/**
 * Records a document the browser already uploaded to
 * editor-docs/<workspace id>/<editor id>/…
 * (uploads go straight to storage so big PDFs skip the server). Replaces any
 * earlier document of the same type.
 */
export async function recordDocument(docType: string, path: string, fileName: string): Promise<ActionResult> {
  const user = await requireEditor();
  const parsed = z
    .object({
      docType: z.enum(DOC_TYPES.map((d) => d.value) as ["contract", "nda"]),
      path: z.string().startsWith(`${user.workspace.id}/${user.id}/`).max(300),
      fileName: z.string().trim().min(1).max(200),
    })
    .safeParse({ docType, path, fileName });
  if (!parsed.success) return fail("Invalid upload.");

  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("editor_documents")
    .select("id, storage_path")
    .eq("editor_id", user.id)
    .eq("doc_type", parsed.data.docType);

  const { error } = await supabase.from("editor_documents").insert({
    editor_id: user.id,
    doc_type: parsed.data.docType,
    storage_path: parsed.data.path,
    file_name: parsed.data.fileName,
  });
  if (error) return fail(error.message);

  if (previous?.length) {
    await supabase.from("editor_documents").delete().in("id", previous.map((d) => d.id));
    await supabase.storage.from("editor-docs").remove(previous.map((d) => d.storage_path));
  }

  revalidateOnboarding(user.id);
  return { ok: true };
}

export async function removeDocument(documentId: string): Promise<ActionResult> {
  const user = await requireEditor();
  if (!z.uuid().safeParse(documentId).success) return fail("Invalid document.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("editor_documents")
    .delete()
    .eq("id", documentId)
    .eq("editor_id", user.id)
    .select("storage_path")
    .maybeSingle();
  if (error) return fail(error.message);
  if (data) await supabase.storage.from("editor-docs").remove([data.storage_path]);

  revalidateOnboarding(user.id);
  return { ok: true };
}

/** Saves how the editor gets paid. Only the fields for the chosen method are kept. */
export async function savePaymentDetails(formData: FormData): Promise<ActionResult> {
  const user = await requireEditor();
  const method = String(formData.get("method") ?? "");
  if (!isPaymentMethod(method)) return fail("Choose how you'd like to be paid.", { method: "Choose a payment method." });

  const fields = PAYMENT_METHODS[method].fields;
  const schema = z.object(
    Object.fromEntries(
      fields.map((field) => [
        field.key,
        field.required
          ? z.string().trim().min(1, `Enter the ${field.label.toLowerCase()}.`).max(300)
          : optionalText(300),
      ]),
    ),
  );
  const parsed = schema.safeParse(Object.fromEntries(fields.map((field) => [field.key, formData.get(field.key) ?? ""])));
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error));
  if ("email" in parsed.data && !z.email().safeParse(parsed.data.email).success) {
    return fail("Please check the highlighted fields.", { email: "Enter a valid email." });
  }

  const details = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value));
  const supabase = await createClient();
  const { error } = await supabase
    .from("editor_payment_details")
    .upsert(
      { workspace_id: user.workspace.id, editor_id: user.id, method, details, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id,editor_id" },
    );
  if (error) return fail(error.message);

  revalidateOnboarding(user.id);
  return { ok: true };
}

/** Steps ReEdit can't check for itself (joined Frame.io, downloaded the asset pack). */
export async function setOnboardingStep(key: string, done: boolean): Promise<ActionResult> {
  const user = await requireEditor();
  if (!(SELF_REPORTED_STEPS as readonly string[]).includes(key)) return fail("This step completes itself.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_onboarding_step", { p_key: key, p_done: done });
  if (error) return fail(error.message);

  revalidateOnboarding(user.id);
  return { ok: true };
}

export async function acknowledgeSop(sopId: string): Promise<ActionResult> {
  const user = await requireEditor();
  if (!z.uuid().safeParse(sopId).success) return fail("Invalid SOP.");

  const supabase = await createClient();
  const { error } = await supabase.from("sop_acknowledgments").insert({ sop_id: sopId, editor_id: user.id });
  // Already acknowledged counts as success.
  if (error && error.code !== "23505") return fail(error.message);

  revalidateOnboarding(user.id);
  return { ok: true };
}

const submissionSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: "Paste the full link to your edit (https://…)." }).max(500),
  note: optionalText(4000),
});

/** Hands in the test edit (trial task): the link goes on the task and it moves to For Review. */
export async function submitTrialTask(taskId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireEditor();
  if (!z.uuid().safeParse(taskId).success) return fail("Invalid task.");
  const parsed = submissionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, status")
    .eq("id", taskId)
    .eq("assignee_id", user.id)
    .eq("is_trial", true)
    .maybeSingle();
  if (!task) return fail("That test edit no longer exists.");
  if (task.status === "done") return fail("Your test edit has already passed.");

  const { error: linkError } = await supabase
    .from("task_attachments")
    .insert({ task_id: taskId, kind: "link", url: parsed.data.url, label: "Test edit submission", added_by: user.id });
  if (linkError) return fail(linkError.message);

  if (parsed.data.note) {
    await supabase.from("task_comments").insert({ task_id: taskId, author_id: user.id, body: parsed.data.note });
  }

  const { error } = await supabase.from("tasks").update({ status: "for_review" }).eq("id", taskId);
  if (error) return fail(error.message);

  revalidateOnboarding(user.id);
  return { ok: true };
}
