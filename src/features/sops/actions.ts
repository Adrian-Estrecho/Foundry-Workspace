"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, fieldErrorsOf, type ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Constants, type Json } from "@/types/database";

/**
 * Writing SOPs (admins). The content is the editor's document (Tiptap
 * JSON); SopContent renders it as React, so nothing in it runs as HTML.
 */

const MAX_CONTENT_CHARS = 200_000;

const document = z
  .string()
  .max(MAX_CONTENT_CHARS, "This SOP is too long. Split it into two.")
  .transform((value, ctx) => {
    try {
      const parsed = JSON.parse(value) as { type?: unknown; content?: unknown };
      if (parsed && parsed.type === "doc" && (parsed.content === undefined || Array.isArray(parsed.content))) {
        return parsed as { [key: string]: Json | undefined };
      }
    } catch {
      // fall through
    }
    ctx.addIssue({ code: "custom", message: "The content couldn't be read. Try again." });
    return z.NEVER;
  });

const sopSchema = z.object({
  title: z.string().trim().min(2, "Give the SOP a title.").max(160, "Keep the title under 160 characters."),
  category: z.enum(Constants.public.Enums.sop_category, { error: "Pick a category." }),
  is_required: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  is_published: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  content: document,
});

function revalidateSops(id?: string) {
  revalidatePath("/sops");
  revalidatePath("/onboarding");
  if (id) revalidatePath(`/sops/${id}/edit`);
}

export async function createSop(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("sops.manage");
  const parsed = sopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.from("sops").insert({ ...parsed.data, created_by: user.id }).select("id").single();
  if (error) return fail("Couldn't save the SOP. Try again.");
  revalidateSops();
  return { ok: true, data: { id: data.id } };
}

/** Saves an SOP. With "ask everyone to read it again", earlier read receipts are cleared. */
export async function updateSop(id: string, formData: FormData): Promise<ActionResult> {
  await requirePermission("sops.manage");
  if (!z.uuid().safeParse(id).success) return fail("That SOP isn't available.");
  const parsed = sopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { error, count } = await supabase.from("sops").update(parsed.data, { count: "exact" }).eq("id", id);
  if (error || !count) return fail("Couldn't save the SOP. Try again.");

  if (formData.get("reset_reads") === "on") {
    const { error: resetError } = await supabase.from("sop_acknowledgments").delete().eq("sop_id", id);
    if (resetError) return fail("Saved, but couldn't clear the read receipts. Try again.");
  }
  revalidateSops(id);
  return { ok: true };
}

export async function deleteSop(id: string): Promise<ActionResult> {
  await requirePermission("sops.manage");
  if (!z.uuid().safeParse(id).success) return fail("That SOP isn't available.");
  const supabase = await createClient();
  const { error, count } = await supabase.from("sops").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return fail("Couldn't delete the SOP. Try again.");
  revalidateSops();
  return { ok: true };
}
