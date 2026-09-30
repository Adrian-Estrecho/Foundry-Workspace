"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, fieldErrorsOf, optionalText, optionalUrl, type ActionResult as Result } from "@/lib/action-result";
import { can, requirePermission } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { HEX_PATTERN } from "@/lib/theme";
import { LOGO_BUCKET, LOGO_PATH, SLUG_PATTERN } from "@/features/workspaces/constants";

const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Give the workspace a name.").max(60, "Keep the name under 60 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_PATTERN, "Use 3–40 lowercase letters, numbers or dashes (not at the start or end)."),
  accepting_applications: z.preprocess((value) => value === "on", z.boolean()),
  default_accent: z.string().regex(HEX_PATTERN, "Pick a valid colour."),
  asset_pack_url: optionalUrl(),
  frameio_invite_url: optionalUrl(),
  contract_template_url: optionalUrl(),
  missed_clock_in_grace_minutes: z.coerce.number().int().min(0, "Use 0–720 minutes.").max(720, "Use 0–720 minutes."),
});

type WorkspaceField = keyof typeof workspaceSchema.shape;

/** The ability each setting needs (guard_workspace_changes checks the same). */
const FIELD_ABILITY: Record<WorkspaceField, Permission> = {
  name: "workspace.brand",
  slug: "workspace.brand",
  accepting_applications: "workspace.brand",
  default_accent: "workspace.brand",
  missed_clock_in_grace_minutes: "workspace.brand",
  contract_template_url: "workspace.contract",
  frameio_invite_url: "workspace.links",
  asset_pack_url: "workspace.links",
};

const hiringSchema = z.object({
  test_title: optionalText(120),
  test_brief: optionalText(4000),
  test_asset_url: optionalUrl(),
  test_due_days: z.coerce.number().int().min(1, "Between 1 and 30 days.").max(30, "Between 1 and 30 days."),
});

/** Workspace → Test edit: the test new editors get when they join. */
export async function updateHiring(formData: FormData): Promise<Result> {
  const user = await requirePermission("editors.manage");
  const parsed = hiringSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_settings")
    .upsert({ workspace_id: user.workspace.id, ...parsed.data, updated_at: new Date().toISOString() });
  if (error) return fail("Couldn't save the test edit. Try again.");

  revalidatePath("/workspace");
  return { ok: true };
}

/**
 * Workspace → Brand: records a logo the browser already uploaded to
 * workspace-logos, or clears it (null). The old file goes either way.
 */
export async function setWorkspaceLogo(path: string | null): Promise<Result> {
  const user = await requirePermission("workspace.brand");
  if (path !== null && !(LOGO_PATH.test(path) && path.startsWith(`${user.workspace.id}/`))) return fail("Invalid upload.");

  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").update({ logo_path: path }).eq("id", user.workspace.id);
  if (error) return fail("Couldn't save the logo. Try again.");

  const previous = user.workspace.logo_path;
  if (previous && previous !== path) await supabase.storage.from(LOGO_BUCKET).remove([previous]);

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Workspace settings. Owners and admins save everything; people given a
 * workspace ability save only the settings it covers (the rest is ignored).
 */
export async function updateWorkspace(formData: FormData): Promise<Result> {
  const user = await requirePermission("workspace.brand", "workspace.contract", "workspace.links");
  const allowed = (Object.keys(FIELD_ABILITY) as WorkspaceField[]).filter((field) => can(user, FIELD_ABILITY[field]));
  const schema = workspaceSchema.pick(Object.fromEntries(allowed.map((field) => [field, true])) as Record<WorkspaceField, true>);
  const parsed = schema.partial().safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { default_accent, ...rest } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ ...rest, ...(default_accent ? { default_accent: default_accent.toUpperCase() } : {}) })
    .eq("id", user.workspace.id);
  if (error?.code === "42501") return fail("You don't have access to change some of these settings.");
  if (error?.code === "23505") return fail("That link name is taken.", { slug: "That link name is taken. Try another." });
  if (error?.code === "23514") return fail("That link name isn't allowed.", { slug: "That link name isn't allowed." });
  if (error) return fail("Couldn't save the workspace settings. Try again.");

  revalidatePath("/", "layout");
  return { ok: true };
}
