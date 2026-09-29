"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, fieldErrorsOf, type ActionResult } from "@/lib/action-result";
import { requireAdmin, requireUser } from "@/lib/auth";
import { renderEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { adminEmailContext } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { firstName } from "@/lib/utils";
import { REACTIONS } from "./constants";

const MESSAGES: Record<string, string> = {
  empty_message: "Write something first.",
  message_too_long: "Keep messages under 4,000 characters.",
  not_found: "That conversation isn't available.",
};

const dbError = (error: { code?: string; message: string }) =>
  MESSAGES[error.message] ?? (error.code === "42501" ? error.message : "Something went wrong. Try again.");

// -----------------------------------------------------------------------------
// Private messages
// -----------------------------------------------------------------------------
const messageSchema = z.object({
  kind: z.enum(["editor", "client"]),
  subjectId: z.uuid(),
  body: z.string().trim().min(1, "Write something first.").max(4000, "Keep messages under 4,000 characters."),
});

/** Sends a message in an editor's or a client's thread. Replies to clients are also emailed to them. */
export async function sendMessage(input: z.input<typeof messageSchema>): Promise<ActionResult<{ threadId: string }>> {
  const user = await requireUser();
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your message.");
  const { kind, subjectId, body } = parsed.data;
  if (kind === "client" && user.role !== "admin") return fail("Only admins write to clients.");

  const supabase = await createClient();
  const { data: threadId, error } = await supabase.rpc("post_message", { p_kind: kind, p_subject_id: subjectId, p_body: body });
  if (error || !threadId) return fail(error ? dbError(error) : "Couldn't send that. Try again.");

  if (kind === "client") {
    const workspaceId = user.workspace.id;
    after(() => emailClient({ workspaceId, clientId: subjectId, threadId, author: user.full_name, body }));
  }

  revalidatePath("/messages", "layout");
  return { ok: true, data: { threadId } };
}

/**
 * Tells a client about a reply, with a link to their portal. Replies close
 * together share one email: another goes out once they've opened the portal
 * since, or after half an hour.
 */
async function emailClient({
  workspaceId,
  clientId,
  threadId,
  author,
  body,
}: {
  workspaceId: string;
  clientId: string;
  threadId: string;
  author: string;
  body: string;
}) {
  const admin = createAdminClient();
  const [{ data: client }, { data: portal }, { data: thread }] = await Promise.all([
    admin.from("clients").select("email, contact_name").eq("id", clientId).maybeSingle(),
    admin.from("client_portals").select("token, enabled").eq("client_id", clientId).maybeSingle(),
    admin.from("message_threads").select("client_emailed_at, client_last_read_at").eq("id", threadId).maybeSingle(),
  ]);
  if (!client?.email || !portal?.enabled || !thread) return;

  const emailedAt = thread.client_emailed_at ? Date.parse(thread.client_emailed_at) : null;
  const readAt = thread.client_last_read_at ? Date.parse(thread.client_last_read_at) : null;
  if (emailedAt && Date.now() - emailedAt < 30 * 60_000 && !(readAt && readAt > emailedAt)) return;

  const { recipients, accent, companyName } = await adminEmailContext(workspaceId);
  const email = renderEmail({
    brand: companyName,
    accent,
    heading: `New message from ${companyName}`,
    intro: `Hi ${firstName(client.contact_name)}, ${firstName(author)} replied:`,
    rows: [["Message", body.length > 600 ? `${body.slice(0, 600)}…` : body]],
    cta: { label: "Open your project portal", url: `${env.siteUrl}/portal/${portal.token}?view=messages` },
    footnote: "Reply in the portal so the whole team sees it. The link is private to you: please don't share it.",
  });
  await sendEmail({ to: client.email, subject: `New message from ${companyName}`, replyTo: recipients[0], ...email });
  await admin.from("message_threads").update({ client_emailed_at: new Date().toISOString() }).eq("id", threadId);
}

/** Marks a thread read (and its message notifications). */
export async function markThreadRead(threadId: string): Promise<ActionResult> {
  await requireUser();
  if (!z.uuid().safeParse(threadId).success) return fail("That conversation isn't available.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_thread_read", { p_thread_id: threadId });
  if (error) return fail(dbError(error));
  revalidatePath("/", "layout");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Announcements
// -----------------------------------------------------------------------------
const announcementSchema = z.object({
  title: z.string().trim().min(2, "Give it a title.").max(140, "Keep the title under 140 characters."),
  body: z.string().trim().min(1, "Write the announcement.").max(8000, "Keep it under 8,000 characters."),
  is_pinned: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
});

function revalidateAnnouncements() {
  revalidatePath("/messages");
  revalidatePath("/dashboard");
}

export async function createAnnouncement(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = announcementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({ ...parsed.data, author_id: user.id });
  if (error) return fail("Couldn't post the announcement. Try again.");
  revalidateAnnouncements();
  return { ok: true };
}

export async function updateAnnouncement(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = announcementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !z.uuid().safeParse(id).success) {
    return fail("Check the highlighted fields.", parsed.success ? undefined : fieldErrorsOf(parsed.error));
  }
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update(parsed.data).eq("id", id);
  if (error) return fail("Couldn't save the announcement. Try again.");
  revalidateAnnouncements();
  return { ok: true };
}

export async function setAnnouncementPinned(id: string, pinned: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return fail("That announcement isn't available.");
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update({ is_pinned: pinned }).eq("id", id);
  if (error) return fail("Couldn't update the announcement. Try again.");
  revalidateAnnouncements();
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return fail("That announcement isn't available.");
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return fail("Couldn't delete the announcement. Try again.");
  revalidateAnnouncements();
  return { ok: true };
}

/** Adds the caller's reaction, or takes it back if it's already there. */
export async function toggleReaction(announcementId: string, emoji: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!z.uuid().safeParse(announcementId).success || !REACTIONS.includes(emoji)) return fail("Pick one of the reactions.");
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("announcement_reactions")
    .select("emoji")
    .eq("announcement_id", announcementId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("announcement_reactions").delete().eq("announcement_id", announcementId).eq("user_id", user.id).eq("emoji", emoji)
    : await supabase.from("announcement_reactions").insert({ announcement_id: announcementId, user_id: user.id, emoji });
  if (error) return fail("Couldn't save your reaction. Try again.");
  revalidatePath("/messages");
  return { ok: true };
}

const commentSchema = z.string().trim().min(1, "Write a comment first.").max(2000, "Keep comments under 2,000 characters.");

export async function addAnnouncementComment(announcementId: string, body: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (!z.uuid().safeParse(announcementId).success) return fail("That announcement isn't available.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcement_comments")
    .insert({ announcement_id: announcementId, author_id: user.id, body: parsed.data });
  if (error) return fail("Couldn't post your comment. Try again.");
  revalidatePath("/messages");
  return { ok: true };
}

/** Authors remove their own comments; admins remove any (RLS decides). */
export async function deleteAnnouncementComment(commentId: string): Promise<ActionResult> {
  await requireUser();
  if (!z.uuid().safeParse(commentId).success) return fail("That comment isn't available.");
  const supabase = await createClient();
  const { error, count } = await supabase.from("announcement_comments").delete({ count: "exact" }).eq("id", commentId);
  if (error || !count) return fail("Couldn't remove that comment.");
  revalidatePath("/messages");
  return { ok: true };
}

/** Opening the announcements clears the unread badge. */
export async function markAnnouncementsSeen(): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_announcements_seen");
  if (error) return fail("Couldn't update your badge.");
  revalidatePath("/", "layout");
  return { ok: true };
}
