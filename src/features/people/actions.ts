"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { normalizePermissions, TITLE_MAX } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const accessSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["admin", "editor"]),
  title: z
    .string()
    .trim()
    .max(TITLE_MAX, `Keep the title under ${TITLE_MAX} characters.`)
    .transform((value) => value || null),
  permissions: z.array(z.string()).max(50).transform(normalizePermissions),
});

/**
 * People → Access: someone's title, whether they're an admin, and the
 * abilities they have as an editor. Owners and admins only. Nobody changes
 * their own access (their own title is fine), and the owner's stays theirs.
 * guard_member_changes enforces the same in the database.
 */
export async function updateAccess(input: z.input<typeof accessSchema>): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = accessSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the access and try again.");
  const { userId, role, title, permissions } = parsed.data;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", user.workspace.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member || (member.status !== "active" && member.status !== "onboarding")) return fail("They're no longer in this workspace.");

  const self = userId === user.id;
  if (member.role === "owner" && !self) return fail("The owner always has full access.");
  if (!self && role === "admin" && member.status !== "active") return fail("Approve them before making them an admin.");

  // Your own row (and the owner's): only the title changes.
  const changes = self || member.role === "owner" ? { title } : { title, role, permissions };
  const { error } = await supabase
    .from("workspace_members")
    .update(changes)
    .eq("workspace_id", user.workspace.id)
    .eq("user_id", userId);
  if (error) return fail(error.code === "42501" ? error.message : "Couldn't save their access. Try again.");

  revalidatePath("/people");
  return { ok: true };
}
