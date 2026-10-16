"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * The workspace's SOP categories, for people who write SOPs: add, rename,
 * reorder and remove. Removing one moves its SOPs to another first
 * (delete_sop_category in migration 20261017000002_sop_categories).
 */

export type SopCategoryInUse = { id: string; name: string; sops: number };

const name = z
  .string()
  .trim()
  .min(1, "Give the category a name.")
  .max(60, "Keep it under 60 characters.");

const revalidateSops = () => {
  revalidatePath("/sops", "layout");
  revalidatePath("/onboarding");
};

/** Every category in order, with how many SOPs are in each. */
export async function loadSopCategories(): Promise<ActionResult<SopCategoryInUse[]>> {
  await requirePermission("sops.manage");
  const supabase = await createClient();
  const { data, error } = await supabase.from("sop_categories").select("id, name, sops!sops_category_fkey(count)").order("position").order("name");
  if (error) return fail("Couldn't load the categories. Try again.");
  return { ok: true, data: (data ?? []).map((c) => ({ id: c.id, name: c.name, sops: c.sops[0]?.count ?? 0 })) };
}

/** A new category, after the last one. */
export async function addSopCategory(value: string): Promise<ActionResult<{ id: string; name: string }>> {
  await requirePermission("sops.manage");
  const parsed = name.safeParse(value);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: last } = await supabase.from("sop_categories").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("sop_categories")
    .insert({ name: parsed.data, position: (last?.position ?? 0) + 1 })
    .select("id, name")
    .single();
  if (error) {
    if (error.code === "23505") return fail(`There's already a category called ${parsed.data}.`);
    return fail("Couldn't add the category. Try again.");
  }
  revalidateSops();
  return { ok: true, data };
}

export async function renameSopCategory(id: string, value: string): Promise<ActionResult> {
  await requirePermission("sops.manage");
  if (!z.uuid().safeParse(id).success) return fail("That category isn't there any more.");
  const parsed = name.safeParse(value);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error, count } = await supabase.from("sop_categories").update({ name: parsed.data }, { count: "exact" }).eq("id", id);
  if (error) {
    if (error.code === "23505") return fail(`There's already a category called ${parsed.data}.`);
    return fail("Couldn't rename the category. Try again.");
  }
  if (!count) return fail("That category isn't there any more.");
  revalidateSops();
  return { ok: true };
}

/** Saves the whole order at once. */
export async function reorderSopCategories(ids: string[]): Promise<ActionResult> {
  await requirePermission("sops.manage");
  if (!z.array(z.uuid()).max(200).safeParse(ids).success) return fail("Couldn't save the order. Try again.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_sop_categories", { p_ids: ids });
  if (error) return fail("Couldn't save the order. Try again.");
  revalidateSops();
  return { ok: true };
}

/** Removes a category; its SOPs move to `moveTo` (needed when it has any). */
export async function removeSopCategory(id: string, moveTo: string | null): Promise<ActionResult> {
  await requirePermission("sops.manage");
  if (!z.uuid().safeParse(id).success || (moveTo !== null && !z.uuid().safeParse(moveTo).success)) {
    return fail("That category isn't there any more.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_sop_category", { p_id: id, p_move_to: moveTo as string });
  if (error) {
    // The function's own messages ("Keep at least one category.", "Choose where its SOPs go.") read well as they are.
    if (error.code === "P0001" || error.code === "P0002") return fail(error.message);
    return fail("Couldn't remove the category. Try again.");
  }
  revalidateSops();
  return { ok: true };
}
