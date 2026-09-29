"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PORTAL_TOKEN } from "./constants";

// -----------------------------------------------------------------------------
// From the portal (no login: the private link is the key)
// -----------------------------------------------------------------------------
const PORTAL_ERRORS: Record<string, string> = {
  invalid_link: "This link doesn't work any more. Ask the team for a new one.",
  empty_message: "Write something first.",
  message_too_long: "Keep messages under 4,000 characters.",
  rate_limited: "That's a lot of messages at once. Wait a few minutes, then try again.",
};

const portalMessage = z.object({
  token: z.string().regex(PORTAL_TOKEN),
  body: z.string().trim().min(1, "Write something first.").max(4000, "Keep messages under 4,000 characters."),
});

/** A client writes to the team. The database checks the link and limits the rate. */
export async function sendPortalMessage(token: string, body: string): Promise<ActionResult> {
  const parsed = portalMessage.safeParse({ token, body });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your message.");

  const { error } = await createAdminClient().rpc("post_client_message", { p_token: parsed.data.token, p_body: parsed.data.body });
  if (error) return fail(PORTAL_ERRORS[error.message] ?? "Couldn't send that. Try again.");
  revalidatePath(`/portal/${parsed.data.token}`);
  return { ok: true };
}

/** Notes that the client opened their portal (and, on Messages, read the replies). */
export async function markPortalViewed(token: string, { messages }: { messages: boolean }): Promise<void> {
  if (!PORTAL_TOKEN.test(token)) return;
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: portal } = await admin
    .from("client_portals")
    .update({ last_viewed_at: now })
    .eq("token", token)
    .eq("enabled", true)
    .select("client_id")
    .maybeSingle();
  if (portal && messages) {
    await admin.from("message_threads").update({ client_last_read_at: now }).eq("kind", "client").eq("client_id", portal.client_id);
  }
}

// -----------------------------------------------------------------------------
// Admins: create, replace and turn off a client's link
// -----------------------------------------------------------------------------
const newToken = () => randomBytes(24).toString("base64url");
const clientId = z.uuid();

function revalidateClient(id: string) {
  revalidatePath(`/clients/${id}`);
  revalidatePath("/messages/clients", "layout");
  revalidatePath("/projects", "layout");
}

/** Turns a client's portal on, creating its link the first time. Returns the link's token. */
export async function openClientPortal(id: string): Promise<ActionResult<{ token: string }>> {
  await requireAdmin();
  if (!clientId.safeParse(id).success) return fail("That client isn't available.");
  const supabase = await createClient();

  const { data: existing } = await supabase.from("client_portals").select("token, enabled").eq("client_id", id).maybeSingle();
  if (existing) {
    if (!existing.enabled) {
      const { error } = await supabase.from("client_portals").update({ enabled: true }).eq("client_id", id);
      if (error) return fail("Couldn't turn the portal on. Try again.");
    }
    revalidateClient(id);
    return { ok: true, data: { token: existing.token } };
  }

  const token = newToken();
  const { error } = await supabase.from("client_portals").insert({ client_id: id, token });
  if (error) return fail("Couldn't create the portal. Try again.");
  revalidateClient(id);
  return { ok: true, data: { token } };
}

/** A new link; the old one stops working straight away. */
export async function resetClientPortal(id: string): Promise<ActionResult<{ token: string }>> {
  await requireAdmin();
  if (!clientId.safeParse(id).success) return fail("That client isn't available.");
  const token = newToken();
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("client_portals")
    .update({ token, enabled: true, last_viewed_at: null }, { count: "exact" })
    .eq("client_id", id);
  if (error || !count) return fail("Couldn't make a new link. Try again.");
  revalidateClient(id);
  return { ok: true, data: { token } };
}

export async function closeClientPortal(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!clientId.safeParse(id).success) return fail("That client isn't available.");
  const supabase = await createClient();
  const { error } = await supabase.from("client_portals").update({ enabled: false }).eq("client_id", id);
  if (error) return fail("Couldn't turn the portal off. Try again.");
  revalidateClient(id);
  return { ok: true };
}
