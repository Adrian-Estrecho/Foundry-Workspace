"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Constants } from "@/types/database";

export type ClientActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const stageSchema = z.enum(Constants.public.Enums.client_stage);
const paymentSchema = z.enum(Constants.public.Enums.payment_status);
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const text = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable());

const fail = (error: string, fieldErrors?: Record<string, string>) => ({ ok: false as const, error, fieldErrors });
const errorsOf = (error: z.ZodError) => {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
  return fieldErrors;
};

function revalidateClient(id?: string) {
  revalidatePath("/clients");
  if (id) revalidatePath(`/clients/${id}`);
}

// -----------------------------------------------------------------------------
// Pipeline
// -----------------------------------------------------------------------------

/** Drag-and-drop move: new stage and/or order within the column. */
export async function moveClient(id: string, stage: string, position: number): Promise<ClientActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: z.uuid(), stage: stageSchema, position: z.number().finite() }).safeParse({ id, stage, position });
  if (!parsed.success) return fail("Invalid move.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ stage: parsed.data.stage, position: parsed.data.position })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  revalidateClient(id);
  return { ok: true };
}

/** Stage change from a menu or the client page: the card goes to the bottom of its new column. */
export async function setClientStage(id: string, stage: string): Promise<ClientActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: z.uuid(), stage: stageSchema }).safeParse({ id, stage });
  if (!parsed.success) return fail("Invalid stage.");

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("clients")
    .select("position")
    .eq("stage", parsed.data.stage)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("clients")
    .update({ stage: parsed.data.stage, position: (last?.position ?? 0) + 1 })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  revalidateClient(id);
  return { ok: true };
}

const contactSchema = z.object({
  contact_name: z.string().trim().min(2, "Enter the contact's name.").max(120),
  company: text(120),
  email: z.preprocess(blankToNull, z.email("Enter a valid email.").nullable()),
  phone: text(40),
  project_type: text(60),
  budget_range: text(40),
  deadline: z.preprocess(blankToNull, z.iso.date().nullable()),
});

/** A client added by hand (referral, repeat customer) rather than via the intake form. */
export async function createClientRecord(formData: FormData): Promise<ClientActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = contactSchema.extend({ stage: stageSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", errorsOf(parsed.error));

  const supabase = await createClient();
  const { data: first } = await supabase
    .from("clients")
    .select("position")
    .eq("stage", parsed.data.stage)
    .order("position")
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.data, position: (first?.position ?? 1) - 1 })
    .select("id")
    .single();
  if (error) return fail(error.message);

  revalidateClient();
  return { ok: true, data: { id: data.id } };
}

/** Deletes a client (e.g. a spam lead). Clients with projects can't be deleted. */
export async function deleteClientRecord(id: string): Promise<ClientActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return fail("Invalid client.");

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("lead_id, contract_path").eq("id", id).maybeSingle();
  if (!client) return fail("That client no longer exists.");

  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) {
    return fail(error.code === "23503" ? "This client has projects. Delete or move those first." : error.message);
  }
  // The contract's storage policy needs the client to exist, so the cleanup
  // runs as the service role, on the path this admin could read above.
  if (client.contract_path) await createAdminClient().storage.from("contracts").remove([client.contract_path]);
  if (client.lead_id) await supabase.from("leads").delete().eq("id", client.lead_id);

  revalidateClient();
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Client page
// -----------------------------------------------------------------------------

export async function updateClientContact(id: string, formData: FormData): Promise<ClientActionResult> {
  await requireAdmin();
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", errorsOf(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(parsed.data).eq("id", id);
  if (error) return fail(error.message);

  revalidateClient(id);
  return { ok: true };
}

export async function updateCallNotes(id: string, notes: string): Promise<ClientActionResult> {
  await requireAdmin();
  const parsed = z.string().max(20_000).safeParse(notes);
  if (!parsed.success) return fail("Notes are too long.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ call_notes: parsed.data.trim() || null })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidateClient(id);
  return { ok: true };
}

export async function updateDriveFolder(id: string, url: string): Promise<ClientActionResult> {
  await requireAdmin();
  const parsed = z
    .preprocess(blankToNull, z.url({ protocol: /^https?$/, error: "Enter a full link starting with https://" }).nullable())
    .safeParse(url);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid link.");

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ drive_folder_url: parsed.data }).eq("id", id);
  if (error) return fail(error.message);

  revalidateClient(id);
  return { ok: true };
}

export async function setPaymentStatus(
  id: string,
  field: "deposit_status" | "final_status",
  status: string,
): Promise<ClientActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ field: z.enum(["deposit_status", "final_status"]), status: paymentSchema })
    .safeParse({ field, status });
  if (!parsed.success) return fail("Invalid payment status.");

  const supabase = await createClient();
  const update =
    parsed.data.field === "deposit_status" ? { deposit_status: parsed.data.status } : { final_status: parsed.data.status };
  const { error } = await supabase.from("clients").update(update).eq("id", id);
  if (error) return fail(error.message);

  revalidateClient(id);
  return { ok: true };
}

/**
 * Records a contract the browser already uploaded to storage (uploads go
 * straight to Supabase Storage so large PDFs don't pass through the server).
 * Passing null removes the contract. The previous file is deleted either way.
 */
export async function setContract(id: string, path: string | null): Promise<ClientActionResult> {
  await requireAdmin();
  if (path !== null && !path.startsWith(`${id}/`)) return fail("Invalid file location.");

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("contract_path").eq("id", id).maybeSingle();
  if (!client) return fail("That client no longer exists.");

  const { error } = await supabase.from("clients").update({ contract_path: path }).eq("id", id);
  if (error) return fail(error.message);
  if (client.contract_path && client.contract_path !== path) {
    await supabase.storage.from("contracts").remove([client.contract_path]);
  }

  revalidateClient(id);
  return { ok: true };
}

export async function toggleChecklistItem(itemId: string, done: boolean): Promise<ClientActionResult> {
  const user = await requireAdmin();
  if (!z.uuid().safeParse(itemId).success) return fail("Invalid item.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_checklist_items")
    .update({ is_done: done, done_at: done ? new Date().toISOString() : null, done_by: done ? user.id : null })
    .eq("id", itemId)
    .select("client_id")
    .single();
  if (error) return fail(error.message);

  revalidateClient(data.client_id);
  return { ok: true };
}
