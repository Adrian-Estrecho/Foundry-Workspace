import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { errorMessage, handleWebhook, loadConnection, loadSyncContext, recordError, type WebhookPayload } from "@/features/clickup/sync";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ClickUp calls this when something changes in a connected workspace
 * (registered by connectClickUp). Each call is signed with the webhook's
 * secret: X-Signature is the HMAC-SHA256 of the body, in hex.
 */
function signedBy(body: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const given = Buffer.from(signature.trim().toLowerCase());
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  const body = await request.text();
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(body) as WebhookPayload;
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  if (!payload.webhook_id) return new NextResponse("Bad request", { status: 400 });

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("clickup_connections")
    .select("workspace_id")
    .eq("webhook_id", payload.webhook_id)
    .maybeSingle();
  // No workspace uses this webhook any more: ClickUp stops calling after enough of these.
  if (!connection) return new NextResponse("Gone", { status: 410 });

  const workspaceId = connection.workspace_id;
  const { data: secret } = await admin.from("clickup_secrets").select("webhook_secret").eq("workspace_id", workspaceId).maybeSingle();
  if (!secret?.webhook_secret || !signedBy(body, request.headers.get("x-signature"), secret.webhook_secret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const clickup = await loadConnection(admin, workspaceId);
    if (!clickup) return new NextResponse("Gone", { status: 410 });
    await handleWebhook(await loadSyncContext(admin, clickup), payload);
    await admin.from("clickup_connections").update({ last_event_at: new Date().toISOString() }).eq("workspace_id", workspaceId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error);
    console.error("[clickup] webhook failed:", payload.event, message);
    await recordError(admin, workspaceId, `An update from ClickUp (${payload.event ?? "event"}) failed: ${message}`);
    // ClickUp retries, and "Sync now" catches up on anything missed.
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
}
