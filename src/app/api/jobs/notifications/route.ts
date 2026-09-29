import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { renderEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { workspaceLink } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/types/database";

/**
 * Emails notifications nobody has seen in the app. pg_cron calls this
 * through pg_net once a minute when some are waiting
 * (request_notification_emails in 0014_notifications.sql), with the shared
 * secret from Vault. Each person gets one email per workspace: the
 * notification itself, or a short digest when there are several.
 */

// Development only: the secret seed.sql stores in the local Vault.
const LOCAL_SECRET = "foundry-local-jobs-secret";

function authorized(request: Request) {
  const secret = process.env.JOBS_SECRET || (process.env.NODE_ENV === "development" ? LOCAL_SECRET : "");
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const KIND: Partial<Record<Enums<"notification_type">, string>> = {
  task_assigned: "Task",
  task_due_tomorrow: "Due soon",
  revision_requested: "Changes",
  task_for_review: "Review",
  task_overdue: "Overdue",
  mention: "Mention",
  new_message: "Message",
  new_announcement: "Announcement",
  missed_clock_in: "Attendance",
  offline_with_overdue: "Attendance",
  blocker_reported: "Blocker",
  shift_ended: "Attendance",
  member_joined: "Team",
  onboarding_ready: "Team",
  editor_onboarded: "Team",
};

const ACTION: Partial<Record<Enums<"notification_type">, string>> = {
  new_message: "Reply",
  new_announcement: "Read it",
  task_for_review: "Review it",
  mention: "Open the task",
  task_assigned: "Open the task",
  task_due_tomorrow: "Open the task",
  task_overdue: "Open the task",
  revision_requested: "See the feedback",
};

type Claimed = {
  id: string;
  workspace_id: string;
  user_id: string;
  type: Enums<"notification_type">;
  title: string;
  body: string | null;
  link: string | null;
  email: string;
  full_name: string;
  workspace_name: string;
  accent: string;
};

export async function POST(request: Request) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_notification_emails", { p_limit: 200 });
  if (error) {
    console.error("[jobs] couldn't claim notification emails:", error.message);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  const groups = new Map<string, Claimed[]>();
  for (const row of (data ?? []) as Claimed[]) {
    const key = `${row.user_id}:${row.workspace_id}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  for (const items of groups.values()) {
    const [first] = items;
    const link = (path: string | null) => workspaceLink(env.siteUrl, first.workspace_id, path ?? "/dashboard");
    const footnote = `You get these when something in ${first.workspace_name} needs you while you're away from ReEdit. Choose which emails you get in Settings.`;

    const email =
      items.length === 1
        ? renderEmail({
            brand: first.workspace_name,
            accent: first.accent,
            heading: first.title,
            intro: first.body ?? undefined,
            cta: { label: ACTION[first.type] ?? "Open in ReEdit", url: link(first.link) },
            footnote,
          })
        : renderEmail({
            brand: first.workspace_name,
            accent: first.accent,
            heading: `${items.length} updates for you`,
            intro: `Hi ${first.full_name.split(" ")[0] || "there"}, here's what happened in ${first.workspace_name}:`,
            rows: items.slice(0, 12).map((n) => [KIND[n.type] ?? "Update", n.body ? `${n.title}\n${n.body}` : n.title]),
            cta: { label: "Open ReEdit", url: link("/dashboard") },
            footnote: items.length > 12 ? `And ${items.length - 12} more in the app. ${footnote}` : footnote,
          });

    await sendEmail({
      to: first.email,
      subject: items.length === 1 ? first.title : `${items.length} updates in ${first.workspace_name}`,
      ...email,
    });
  }

  return NextResponse.json({ notifications: data?.length ?? 0, emails: groups.size });
}
