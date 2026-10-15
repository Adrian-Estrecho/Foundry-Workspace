"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { PORTAL_TOKEN } from "@/features/portal/constants";
import { fail, type ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/*
 * The links portal: one private link per workspace to every client's
 * Frame.io and Drive links, no login. Managed like a client's portal link.
 */

const newToken = () => randomBytes(24).toString("base64url");

/** Turns the links portal on, creating its link the first time. */
export async function openLinkPortal(): Promise<ActionResult<{ token: string }>> {
  const user = await requirePermission("clients.manage");
  const supabase = await createClient();

  const { data: existing } = await supabase.from("link_portals").select("token, enabled").eq("workspace_id", user.workspace.id).maybeSingle();
  if (existing) {
    if (!existing.enabled) {
      const { error } = await supabase.from("link_portals").update({ enabled: true }).eq("workspace_id", user.workspace.id);
      if (error) return fail("Couldn't turn the link on. Try again.");
    }
    revalidatePath("/clients/links");
    return { ok: true, data: { token: existing.token } };
  }

  const token = newToken();
  const { error } = await supabase.from("link_portals").insert({ workspace_id: user.workspace.id, token });
  if (error) return fail("Couldn't create the link. Try again.");
  revalidatePath("/clients/links");
  return { ok: true, data: { token } };
}

/** A new link; the old one stops working straight away. */
export async function resetLinkPortal(): Promise<ActionResult<{ token: string }>> {
  const user = await requirePermission("clients.manage");
  const token = newToken();
  const { error, count } = await (await createClient())
    .from("link_portals")
    .update({ token, enabled: true, last_viewed_at: null }, { count: "exact" })
    .eq("workspace_id", user.workspace.id);
  if (error || !count) return fail("Couldn't make a new link. Try again.");
  revalidatePath("/clients/links");
  return { ok: true, data: { token } };
}

export async function closeLinkPortal(): Promise<ActionResult> {
  const user = await requirePermission("clients.manage");
  const { error } = await (await createClient()).from("link_portals").update({ enabled: false }).eq("workspace_id", user.workspace.id);
  if (error) return fail("Couldn't turn the link off. Try again.");
  revalidatePath("/clients/links");
  return { ok: true };
}

/** From the portal (no login): notes that someone opened it. */
export async function markLinkPortalViewed(token: string): Promise<void> {
  if (!PORTAL_TOKEN.test(token)) return;
  await createAdminClient()
    .from("link_portals")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("token", token)
    .eq("enabled", true);
}
