import { NextResponse } from "next/server";
import { errorMessage, pushQueuedMoves } from "@/features/clickup/sync";
import { authorizedJob } from "@/lib/jobs";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sends status moves made in ReEdit to ClickUp. The database calls this
 * through pg_net as soon as a synced task moves, and every minute while
 * moves are waiting for a retry (request_clickup_push in
 * 20261001000003_clickup.sql).
 */
export async function POST(request: Request) {
  if (!authorizedJob(request)) return new NextResponse("Unauthorized", { status: 401 });

  try {
    return NextResponse.json(await pushQueuedMoves(createAdminClient()));
  } catch (error) {
    console.error("[jobs] couldn't push ClickUp moves:", errorMessage(error));
    return NextResponse.json({ error: "push_failed" }, { status: 500 });
  }
}
