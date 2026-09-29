"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  FIELD_ID,
  FIELD_TYPES,
  MAX_FIELDS,
  MAX_OPTIONS,
  builtinOf,
  defaultFields,
  isChoice,
  isFormKind,
  normalizeFields,
  type FormField,
  type FormKind,
} from "./fields";

const fieldSchema = z.object({
  id: z.string().regex(FIELD_ID),
  type: z.enum(FIELD_TYPES),
  label: z.string().trim().min(1, "Every field needs a label.").max(120, "Keep labels under 120 characters."),
  help: z.string().trim().max(300, "Keep help text under 300 characters.").optional(),
  placeholder: z.string().trim().max(200).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().max(80, "Keep options under 80 characters.")).max(MAX_OPTIONS).optional(),
});

const formSchema = z.array(fieldSchema).max(MAX_FIELDS, `A form can have up to ${MAX_FIELDS} fields.`);

/** Saves a public form's fields. Returns them as they'll be shown. */
export async function saveForm(kind: FormKind, input: FormField[]): Promise<ActionResult<{ fields: FormField[] }>> {
  const user = await requireAdmin();
  if (!isFormKind(kind)) return fail("Unknown form.");

  const parsed = formSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");

  const ids = new Set<string>();
  for (const field of parsed.data) {
    if (ids.has(field.id)) return fail("Two fields have the same id. Reload the page and try again.");
    ids.add(field.id);
    if (!isChoice(field.type)) continue;
    const builtin = builtinOf(kind, field.id);
    if (builtin && !builtin.optionsEditable) continue;
    const options = (field.options ?? []).filter(Boolean);
    if (options.length === 0) return fail(`Add at least one option to "${field.label}".`);
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
      return fail(`"${field.label}" has the same option twice.`);
    }
  }
  if (!parsed.data.some((f) => f.type !== "section")) return fail("Keep at least one question on the form.");

  const fields = normalizeFields(kind, parsed.data);
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_forms")
    .upsert({ workspace_id: user.workspace.id, kind, fields, updated_by: user.id, updated_at: new Date().toISOString() });
  if (error) return fail("Couldn't save the form. Try again.");

  revalidatePath("/workspace", "layout");
  return { ok: true, data: { fields } };
}

/** Back to the built-in form. */
export async function resetForm(kind: FormKind): Promise<ActionResult<{ fields: FormField[] }>> {
  const user = await requireAdmin();
  if (!isFormKind(kind)) return fail("Unknown form.");

  const supabase = await createClient();
  const { error } = await supabase.from("workspace_forms").delete().eq("workspace_id", user.workspace.id).eq("kind", kind);
  if (error) return fail("Couldn't reset the form. Try again.");

  revalidatePath("/workspace", "layout");
  return { ok: true, data: { fields: defaultFields(kind) } };
}
