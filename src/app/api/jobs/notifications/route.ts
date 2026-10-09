import { NextResponse } from "next/server";
import {
  notificationEmail,
  type ClaimedNotification,
  type EmailMessage,
  type EmailTask,
} from "@/features/notifications/emails";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { authorizedJob } from "@/lib/jobs";
import { workspaceLink } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/utils";

/**
 * Emails notifications nobody has seen in the app. pg_cron calls this
 * through pg_net once a minute when some are waiting
 * (request_notification_emails in 0014_notifications.sql), with the shared
 * secret from Vault. Each person gets one email per workspace: the
 * notification itself, or a short digest when there are several.
 */

type Admin = ReturnType<typeof createAdminClient>;

const taskIdsOf = (n: ClaimedNotification) => {
  const listed = (n.meta as { task_ids?: unknown } | null)?.task_ids;
  return [
    ...(n.entity_type === "task" && n.entity_id ? [n.entity_id] : []),
    ...(Array.isArray(listed) ? listed.filter((id): id is string => typeof id === "string") : []),
  ];
};

async function loadTasks(admin: Admin, ids: string[]) {
  const tasks = new Map<string, EmailTask>();
  if (ids.length === 0) return tasks;
  const { data } = await admin
    .from("tasks")
    .select(
      "id, title, description, due_date, priority, status, is_trial, assignee_id, project:projects(name, client:clients(company, contact_name))",
    )
    .in("id", ids);
  const assigneeIds = [...new Set((data ?? []).flatMap((t) => (t.assignee_id ? [t.assignee_id] : [])))];
  const { data: people } = assigneeIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", assigneeIds)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  for (const t of data ?? []) {
    const project = one(t.project);
    const client = one(project?.client);
    tasks.set(t.id, {
      id: t.id,
      title: t.title,
      description: t.description,
      due_date: t.due_date,
      priority: t.priority,
      status: t.status,
      is_trial: t.is_trial,
      assignee_id: t.assignee_id,
      assignee: t.assignee_id ? (names.get(t.assignee_id) ?? null) : null,
      project: project?.name ?? null,
      client: client?.company ?? client?.contact_name ?? null,
    });
  }
  return tasks;
}

/**
 * The newest messages from the other side of each thread that the reader
 * hasn't seen, up to three, oldest first.
 */
async function loadMessages(admin: Admin, notifications: ClaimedNotification[]) {
  const messages = new Map<string, EmailMessage[]>();
  const threads = notifications.filter((n) => n.type === "new_message" && n.entity_id);
  if (threads.length === 0) return messages;
  const threadIds = [...new Set(threads.map((n) => n.entity_id!))];

  const [{ data: rows }, { data: reads }] = await Promise.all([
    admin
      .from("messages")
      .select("thread_id, sender, author_id, body, created_at, thread:message_threads(client:clients(company, contact_name))")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false })
      .limit(threadIds.length * 10),
    admin
      .from("message_reads")
      .select("thread_id, user_id, last_read_at")
      .in("thread_id", threadIds)
      .in("user_id", [...new Set(threads.map((n) => n.user_id))]),
  ]);
  const authorIds = [...new Set((rows ?? []).flatMap((m) => (m.author_id ? [m.author_id] : [])))];
  const { data: people } = authorIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  for (const n of threads) {
    const readAt = reads?.find((r) => r.thread_id === n.entity_id && r.user_id === n.user_id)?.last_read_at;
    const theirs = (rows ?? []).filter(
      (m) =>
        m.thread_id === n.entity_id &&
        (n.role === "editor" ? m.sender === "admin" : m.sender !== "admin") &&
        (!readAt || m.created_at > readAt),
    );
    messages.set(
      n.entity_id!,
      theirs
        .slice(0, 3)
        .reverse()
        .map((m) => {
          const client = one(one(m.thread)?.client);
          return {
            author: m.author_id ? (names.get(m.author_id) ?? "Someone") : (client?.company ?? client?.contact_name ?? "Your client"),
            body: m.body,
            at: m.created_at,
          };
        }),
    );
  }
  return messages;
}

/** The comment behind each mention or change request. */
async function loadComments(admin: Admin, notifications: ClaimedNotification[]) {
  const comments = new Map<string, EmailMessage>();
  const wanted = notifications.filter(
    (n) => (n.type === "mention" || n.type === "revision_requested") && n.entity_type === "task" && n.entity_id,
  );
  if (wanted.length === 0) return comments;

  const { data } = await admin
    .from("task_comments")
    .select("task_id, author_id, clickup_author, body, mentions, created_at, author:profiles(full_name)")
    .in("task_id", [...new Set(wanted.map((n) => n.entity_id!))])
    .order("created_at", { ascending: false })
    .limit(wanted.length * 10);

  for (const n of wanted) {
    const before = Date.parse(n.created_at) + 5_000;
    const comment = (data ?? []).find(
      (c) =>
        c.task_id === n.entity_id &&
        Date.parse(c.created_at) <= before &&
        (n.type === "mention" ? c.mentions.includes(n.user_id) : c.author_id !== n.user_id),
    );
    if (comment && (n.type === "mention" || Date.parse(n.created_at) - Date.parse(comment.created_at) < 5 * 60_000)) {
      comments.set(n.id, { author: one(comment.author)?.full_name ?? comment.clickup_author ?? "Someone", body: comment.body, at: comment.created_at });
    }
  }
  return comments;
}

export async function POST(request: Request) {
  if (!authorizedJob(request)) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_notification_emails", { p_limit: 200 });
  if (error) {
    console.error("[jobs] couldn't claim notification emails:", error.message);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  const claimed = (data ?? []) as ClaimedNotification[];
  const groups = new Map<string, ClaimedNotification[]>();
  for (const row of claimed) {
    const key = `${row.user_id}:${row.workspace_id}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  // Details only matter for notifications emailed on their own.
  const alone = [...groups.values()].filter((items) => items.length === 1).map(([n]) => n);
  const [tasks, messages, comments] = await Promise.all([
    loadTasks(admin, [...new Set(claimed.flatMap(taskIdsOf))]),
    loadMessages(admin, alone),
    loadComments(admin, alone),
  ]);

  for (const items of groups.values()) {
    const [first] = items;
    const email = notificationEmail(items, {
      tasks,
      messages,
      comments,
      link: (path) => workspaceLink(env.siteUrl, first.workspace_id, path),
    });
    await sendEmail({ to: first.email, ...email });
  }

  return NextResponse.json({ notifications: claimed.length, emails: groups.size });
}
