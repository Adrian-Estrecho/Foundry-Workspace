import { NextResponse } from "next/server";
import { errorMessage, pushQueuedChanges, pushQueuedItems } from "@/features/clickup/sync";
import { authorizedJob } from "@/lib/jobs";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sends changes made in ReEdit to ClickUp. The database calls this
 * through pg_net as soon as a synced task changes, and every minute while
 * changes are waiting for a retry (request_clickup_push in
 * 20261001000003_clickup.sql): status and field changes, then comments, links
 * and files (uploads can take a while, so they stop starting after 40 s).
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!authorizedJob(request)) return new NextResponse("Unauthorized", { status: 401 });

  const deadline = Date.now() + 40_000;
  try {
    const admin = createAdminClient();
    const changes = await pushQueuedChanges(admin);
    const items = await pushQueuedItems(admin, deadline);
    return NextResponse.json({ changes, items });
  } catch (error) {
    console.error("[jobs] couldn't push ClickUp changes:", errorMessage(error));
    return NextResponse.json({ error: "push_failed" }, { status: 500 });
  }
}
