import { NextResponse } from "next/server";
import { errorMessage, pushQueuedChanges } from "@/features/clickup/sync";
import { authorizedJob } from "@/lib/jobs";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sends changes made in ReEdit to ClickUp. The database calls this
 * through pg_net as soon as a synced task changes, and every minute while
 * changes are waiting for a retry (request_clickup_push in
 * 20261001000003_clickup.sql).
 */
export async function POST(request: Request) {
  if (!authorizedJob(request)) return new NextResponse("Unauthorized", { status: 401 });

  try {
    return NextResponse.json(await pushQueuedChanges(createAdminClient()));
  } catch (error) {
    console.error("[jobs] couldn't push ClickUp changes:", errorMessage(error));
    return NextResponse.json({ error: "push_failed" }, { status: 500 });
  }
}
