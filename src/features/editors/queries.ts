import "server-only";
import { notFound } from "next/navigation";
import type { CurrentUser } from "@/lib/auth";
import { startOfWeek, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/utils";
import type { Enums } from "@/types/database";

/** "Online" before the first presence sync: seen within the last 3 minutes. */
const RECENT_MS = 3 * 60 * 1000;
const seenRecently = (lastSeenAt: string | null | undefined, now: number) =>
  Boolean(lastSeenAt && now - new Date(lastSeenAt).getTime() < RECENT_MS);

export type RosterEditor = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  timezone: string;
  software: string[];
  specialties: string[];
  hourlyRate: number | null;
  weeklyHours: number | null;
  isActive: boolean;
  /** "onboarding" until approved; "rejected" when not taken on. */
  memberStatus: Enums<"member_status">;
  workStatus: Enums<"work_status">;
  recentlySeen: boolean;
  secondsThisWeek: number;
  /** Progress while they're onboarding, null once approved. */
  onboarding: { done: number; total: number } | null;
};

/**
 * Every editors column but hourly_rate, which people read through
 * editor_rates() (only those who manage editors get rows).
 */
const EDITOR_FIELDS =
  "id, workspace_id, applicant_id, software, specialties, weekly_hours, work_days, shift_start, is_active, onboarding_completed_at, work_status, current_task_id, current_shift_id, status_since, created_at, updated_at";

async function editorRates() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("editor_rates");
  return new Map((data ?? []).map((row) => [row.editor_id, row.hourly_rate === null ? null : Number(row.hourly_rate)]));
}

export async function getRoster(user: CurrentUser) {
  const supabase = await createClient();
  const today = todayIn(user.timezone);
  const now = Date.now();

  const [{ data, error }, hours, newApplicants, rates] = await Promise.all([
    supabase
      .from("editors")
      .select(
        `id, software, specialties, weekly_hours, is_active, work_status,
         profile:profiles!editors_id_fkey(full_name, email, avatar_url, timezone, last_seen_at),
         member:workspace_members!editors_member_fkey(status),
         checklist:editor_checklist_items(is_done)`,
      ),
    supabase.rpc("editor_hours", { p_from: startOfWeek(today), p_to: today, p_tz: user.timezone }),
    supabase.from("applicants").select("id", { count: "exact", head: true }).eq("stage", "applied"),
    editorRates(),
  ]);
  if (error) throw error;

  const secondsBy = new Map((hours.data ?? []).map((row) => [row.editor_id, Number(row.seconds)]));
  const editors: RosterEditor[] = (data ?? [])
    .map((e) => ({
      memberStatus: one(e.member)?.status ?? "active",
      id: e.id,
      name: e.profile?.full_name ?? "Editor",
      email: e.profile?.email ?? "",
      avatarUrl: e.profile?.avatar_url ?? null,
      timezone: e.profile?.timezone ?? "UTC",
      software: e.software,
      specialties: e.specialties,
      hourlyRate: rates.get(e.id) ?? null,
      weeklyHours: e.weekly_hours,
      isActive: e.is_active,
      workStatus: e.work_status,
      recentlySeen: seenRecently(e.profile?.last_seen_at, now),
      secondsThisWeek: secondsBy.get(e.id) ?? 0,
      onboarding:
        one(e.member)?.status === "onboarding"
          ? { done: e.checklist.filter((i) => i.is_done).length, total: e.checklist.length }
          : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { editors, newApplicants: newApplicants.count ?? 0, renderedAt: now };
}

export async function getEditorProfile(id: string, user: CurrentUser) {
  const supabase = await createClient();
  const today = todayIn(user.timezone);

  const [{ data: editor }, { data: tasks }, { data: shifts }, hours, { data: interviews }, { data: notes }, { data: activity }, rates] = await Promise.all([
    supabase
      .from("editors")
      .select(
        `${EDITOR_FIELDS},
         profile:profiles!editors_id_fkey(full_name, email, avatar_url, timezone, phone, last_seen_at),
         checklist:editor_checklist_items(*),
         documents:editor_documents(*),
         payment:editor_payment_details(method, details, updated_at),
         applicant:applicants!editors_applicant_id_fkey(id, created_at, portfolio_url, rating),
         member:workspace_members!editors_member_fkey(status, title, joined_at, approved_at)`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select(
        `id, title, status, priority, due_date, completed_at, revision_count, is_trial, description, created_at,
         project:projects(name),
         status_info:task_statuses!tasks_status_id_fkey(name, color),
         attachments:task_attachments(id, kind, url, label, created_at),
         comments:task_comments(id, body, created_at, author:profiles(full_name, avatar_url))`,
      )
      .eq("assignee_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("shifts")
      .select("id, work_date, clock_in_at, clock_out_at, work_seconds, break_seconds")
      .eq("editor_id", id)
      .order("clock_in_at", { ascending: false })
      .limit(8),
    supabase.rpc("editor_hours", { p_from: startOfWeek(today), p_to: today, p_tz: user.timezone }),
    supabase
      .from("editor_interviews")
      .select("id, scheduled_at, duration_minutes, meeting_url, note_to_editor, outcome, decided_at")
      .eq("editor_id", id)
      .order("scheduled_at", { ascending: false }),
    supabase.from("editor_notes").select("body, updated_at").eq("editor_id", id).maybeSingle(),
    supabase
      .from("activity_log")
      .select("id, summary, created_at, actor:profiles(full_name, avatar_url)")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    editorRates(),
  ]);
  if (!editor || !editor.profile) notFound();

  // Documents are private: hand out short-lived links.
  const documents = await Promise.all(
    [...editor.documents]
      .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
      .map(async (doc) => {
        const { data } = await supabase.storage.from("editor-docs").createSignedUrl(doc.storage_path, 60 * 60);
        return { ...doc, url: data?.signedUrl ?? null };
      }),
  );

  const allTasks = tasks ?? [];
  const work = allTasks.filter((t) => !t.is_trial);
  const done = work.filter((t) => t.status === "done");
  const dated = done.filter((t) => t.due_date && t.completed_at);
  const onTime = dated.filter((t) => todayIn(editor.profile!.timezone, new Date(t.completed_at!)) <= t.due_date!).length;

  return {
    editor: { ...editor, hourly_rate: rates.get(editor.id) ?? null },
    profile: editor.profile,
    // Their tasks other than the test edit need tasks.manage (RLS).
    seesWork: user.permissions.includes("tasks.manage"),
    // Bank details stay with owners and admins.
    showPayment: user.role === "admin",
    checklist: [...editor.checklist].sort((a, b) => a.position - b.position),
    documents,
    payment: one(editor.payment),
    trialTasks: allTasks
      .filter((t) => t.is_trial)
      .map((t) => ({
        ...t,
        attachments: [...t.attachments].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        comments: [...t.comments].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      })),
    openTasks: work.filter((t) => t.status !== "done").slice(0, 8),
    recentDone: [...done].sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")).slice(0, 5),
    performance: {
      completed: done.length,
      onTimeRate: dated.length ? Math.round((onTime / dated.length) * 100) : null,
      avgRevisions: done.length ? done.reduce((sum, t) => sum + t.revision_count, 0) / done.length : null,
      open: work.length - done.length,
    },
    secondsThisWeek: Number((hours.data ?? []).find((row) => row.editor_id === id)?.seconds ?? 0),
    shifts: shifts ?? [],
    member: one(editor.member),
    interviews: interviews ?? [],
    notes: notes ?? null,
    activity: activity ?? [],
    today,
    renderedAt: Date.now(),
  };
}

export async function getOnboarding(user: CurrentUser) {
  const supabase = await createClient();
  const settings = user.workspace;
  const [{ data: editor }, { data: checklist }, { data: documents }, { data: payment }, { data: sops }, { data: trials }, { data: interviews }] =
    await Promise.all([
      supabase.from("editors").select("onboarding_completed_at").eq("id", user.id).maybeSingle(),
      supabase.from("editor_checklist_items").select("*").eq("editor_id", user.id).order("position"),
      supabase.from("editor_documents").select("*").eq("editor_id", user.id).order("uploaded_at", { ascending: false }),
      supabase.from("editor_payment_details").select("method, details, updated_at").eq("editor_id", user.id).maybeSingle(),
      supabase
        .from("sops")
        .select("id, title, category, content, acknowledgments:sop_acknowledgments(acknowledged_at)")
        .eq("is_required", true)
        .eq("is_published", true)
        .order("title"),
      supabase
        .from("tasks")
        .select(
          `id, title, description, status, due_date, created_at,
           attachments:task_attachments(id, kind, url, label, created_at),
           comments:task_comments(id, body, created_at, author:profiles(full_name, avatar_url))`,
        )
        .eq("assignee_id", user.id)
        .eq("is_trial", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("editor_interviews")
        .select("id, scheduled_at, duration_minutes, meeting_url, note_to_editor, outcome")
        .eq("editor_id", user.id)
        .neq("outcome", "cancelled")
        .order("scheduled_at", { ascending: false }),
    ]);

  const docs = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data } = await supabase.storage.from("editor-docs").createSignedUrl(doc.storage_path, 60 * 60);
      return { ...doc, url: data?.signedUrl ?? null };
    }),
  );

  return {
    completedAt: editor?.onboarding_completed_at ?? null,
    checklist: checklist ?? [],
    documents: docs,
    payment,
    links: {
      assetPack: settings.asset_pack_url,
      frameio: settings.frameio_invite_url,
      contractTemplates: settings.contract_template_url,
    },
    // RLS only returns the editor's own acknowledgments.
    sops: (sops ?? []).map((sop) => ({
      id: sop.id,
      title: sop.title,
      category: sop.category,
      content: sop.content,
      acknowledgedAt: sop.acknowledgments[0]?.acknowledged_at ?? null,
    })),
    trialTasks: (trials ?? []).map((t) => ({
      ...t,
      attachments: [...t.attachments].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      comments: [...t.comments].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    })),
    /** The latest interview that isn't cancelled. */
    interview: interviews?.[0] ?? null,
    renderedAt: Date.now(),
  };
}
