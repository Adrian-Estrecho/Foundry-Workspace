import { renderEmail, type EmailCard, type EmailChip, type EmailContent, type EmailItem, type EmailTone } from "@/lib/email/render";
import { dueLabel, formatDay, todayIn } from "@/lib/dates";
import { firstName } from "@/lib/utils";
import { taskStageLabel, type TaskPriority, type TaskStatus } from "@/features/tasks/constants";
import type { Enums, Json } from "@/types/database";

/**
 * Emails for notifications nobody has seen in the app (see
 * /api/jobs/notifications). One notification gets its own detailed email;
 * several become a digest. The job loads the tasks and messages they point
 * at; everything here is plain data in, email out.
 */

type NotificationType = Enums<"notification_type">;

export type ClaimedNotification = {
  id: string;
  workspace_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  meta: Json;
  created_at: string;
  email: string;
  full_name: string;
  timezone: string;
  role: Enums<"member_role">;
  workspace_name: string;
  accent: string;
};

export type EmailTask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  is_trial: boolean;
  assignee_id: string | null;
  assignee: string | null;
  project: string | null;
  client: string | null;
};

export type EmailMessage = { author: string; body: string; at: string };

export type NotificationEmailData = {
  tasks: Map<string, EmailTask>;
  /** Recent messages per thread, oldest first. */
  messages: Map<string, EmailMessage[]>;
  /** The comment behind a mention or a change request, per notification. */
  comments: Map<string, EmailMessage>;
  /** Builds a link that opens the workspace first. */
  link: (path: string) => string;
};

const LABEL: Partial<Record<NotificationType, string>> = {
  task_assigned: "New task",
  task_start_reminder: "Reminder",
  task_not_started: "Not started",
  task_due_tomorrow: "Due tomorrow",
  task_due_today: "Due today",
  task_overdue: "Overdue",
  task_for_review: "Ready for review",
  revision_requested: "Changes requested",
  task_approved: "Approved",
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

const TONE: Partial<Record<NotificationType, EmailTone>> = {
  task_start_reminder: "warning",
  task_not_started: "warning",
  task_due_tomorrow: "warning",
  task_due_today: "warning",
  task_overdue: "danger",
  revision_requested: "warning",
  task_approved: "success",
  missed_clock_in: "warning",
  offline_with_overdue: "danger",
  blocker_reported: "danger",
  member_joined: "success",
  onboarding_ready: "success",
  editor_onboarded: "success",
};

const ACTION: Partial<Record<NotificationType, string>> = {
  new_message: "Reply",
  new_announcement: "Read it",
  task_for_review: "Review it",
  missed_clock_in: "Open attendance",
  offline_with_overdue: "See their work",
  blocker_reported: "See the report",
  member_joined: "See their profile",
  onboarding_ready: "Review and approve",
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
const meta = (n: ClaimedNotification) =>
  (n.meta && typeof n.meta === "object" && !Array.isArray(n.meta) ? n.meta : {}) as { reminder?: number; task_ids?: string[]; editor_id?: string };

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Rich-text descriptions come in as HTML; emails show a short plain excerpt. */
const plain = (html: string | null) =>
  html
    ? html
        .replace(/<(br|\/p|\/li|\/h\d)>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n+/g, "\n")
        .trim()
    : "";

const status = (s: TaskStatus) => taskStageLabel(s);

function dueChip(task: EmailTask, today: string): EmailChip | null {
  if (!task.due_date) return null;
  const label = dueLabel(task.due_date, today);
  const tone: EmailTone | undefined = label.includes("overdue")
    ? "danger"
    : label === "Due today" || label === "Due tomorrow"
      ? "warning"
      : undefined;
  return { label: label.startsWith("Due ") && !tone ? `Due ${formatDay(task.due_date)}` : label, tone };
}

function priorityChip(priority: TaskPriority): EmailChip | null {
  if (priority === "urgent") return { label: "Urgent", tone: "danger" };
  if (priority === "high") return { label: "High priority", tone: "warning" };
  return null;
}

function taskCard(task: EmailTask, today: string, { withAssignee = false, withStatus = false } = {}): EmailCard {
  const description = plain(task.description);
  return {
    kicker: [task.client, task.project].filter(Boolean).join(" · ") || (task.is_trial ? "Test edit" : "Internal"),
    title: task.title,
    text: description ? clip(description, 220) : null,
    chips: [
      dueChip(task, today),
      priorityChip(task.priority),
      withStatus && { label: status(task.status) },
      withAssignee && { label: task.assignee ?? "Nobody on it yet" },
    ],
  };
}

function taskItem(task: EmailTask, today: string, url: string): EmailItem {
  return {
    label: task.due_date ? dueLabel(task.due_date, today) : "No due date",
    tone: task.due_date && dueLabel(task.due_date, today).includes("overdue") ? "danger" : "accent",
    title: task.title,
    text: [task.client, task.project].filter(Boolean).join(" · ") || null,
    url,
  };
}

const quoted = (list: EmailMessage[] | undefined, timeZone: string) =>
  (list ?? []).map((m) => ({
    author: m.author,
    body: clip(m.body, 1200),
    meta: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(m.at)),
  }));

// -----------------------------------------------------------------------------
// One notification
// -----------------------------------------------------------------------------
function single(n: ClaimedNotification, data: NotificationEmailData): EmailContent {
  const first = firstName(n.full_name);
  const today = todayIn(n.timezone);
  const url = data.link(n.link ?? "/dashboard");
  const task = n.entity_type === "task" && n.entity_id ? data.tasks.get(n.entity_id) : undefined;
  const { reminder = 1, task_ids = [], editor_id } = meta(n);
  const listed = task_ids.flatMap((id) => data.tasks.get(id) ?? []);
  const isAssignee = task?.assignee_id === n.user_id;
  const base: Pick<EmailContent, "eyebrow" | "tone"> = { eyebrow: LABEL[n.type] ?? "Update", tone: TONE[n.type] ?? "accent" };
  const openTask = { label: "Open the task", url };
  const messageEditor = (id: string | null | undefined, name: string | null | undefined) =>
    id ? { label: `Message ${firstName(name)}`, url: data.link(`/messages/team/${id}`) } : undefined;

  switch (n.type) {
    case "task_assigned":
      if (!task) break;
      if (task.is_trial) {
        return {
          ...base,
          eyebrow: "Test edit",
          heading: "Your test edit is ready",
          intro: `Hi ${first}, here's your test edit for ${n.workspace_name}. It's a short, real-world task so the team can see how you work. Hand it in with a link from your Onboarding page.`,
          card: taskCard(task, today),
          cta: { label: "Open your onboarding", url },
        };
      }
      return {
        ...base,
        heading: "You have a new task",
        intro: `Hi ${first}, there's a new task for you in ${n.workspace_name}${
          task.due_date ? `, due ${formatDay(task.due_date, { weekday: "long", month: "short", day: "numeric" })}` : ""
        }.`,
        card: taskCard(task, today),
        outro: "When you begin, move it to In Progress or start its timer in Attendance.",
        cta: openTask,
        secondary: { label: "All my tasks", url: data.link("/my-tasks") },
      };

    case "task_start_reminder": {
      const tasks = listed.length ? listed : task ? [task] : [];
      if (tasks.length === 0) break;
      const one = tasks.length === 1 ? tasks[0] : null;
      const last = reminder >= 2;
      return {
        ...base,
        eyebrow: `Reminder ${Math.min(reminder, 2)} of 2`,
        heading: one
          ? last
            ? `Still waiting to start “${one.title}”`
            : `Time to start “${one.title}”`
          : last
            ? `${tasks.length} tasks still haven't started`
            : `${tasks.length} tasks are waiting for you`,
        intro: last
          ? `Hi ${first}, ${one ? "this task is" : "these are"} still in To Do. This is the last reminder, so we've let the ${n.workspace_name} admins know as well. If something's in the way, tell them in Messages.`
          : `Hi ${first}, ${one ? "this task was" : "these were"} handed to you an hour ago and ${one ? "it's" : "they're"} still in To Do. When you begin, move ${one ? "it" : "each one"} to In Progress or start ${one ? "its" : "the"} timer in Attendance.`,
        card: one ? taskCard(one, today) : undefined,
        items: one ? undefined : tasks.map((t) => taskItem(t, today, data.link(`/tasks/${t.id}`))),
        cta: one ? { label: "Start the task", url } : { label: "Open my tasks", url: data.link("/my-tasks") },
        secondary: last ? { label: "Message the admins", url: data.link("/messages/team") } : undefined,
      };
    }

    case "task_not_started": {
      const tasks = listed.length ? listed : task ? [task] : [];
      if (tasks.length === 0) break;
      const one = tasks.length === 1 ? tasks[0] : null;
      const editor = tasks[0].assignee ?? "Your editor";
      return {
        ...base,
        heading: one ? `${editor} hasn't started “${one.title}”` : `${editor} hasn't started ${tasks.length} tasks`,
        intro: `${one ? "It was" : "They were"} handed over two working hours ago, and ${firstName(editor)} has had two reminders. ${
          one ? "It's" : "They're"
        } still in To Do, and ${firstName(editor)} isn't working on anything else.`,
        card: one ? taskCard(one, today) : undefined,
        items: one ? undefined : tasks.map((t) => taskItem(t, today, data.link(`/tasks/${t.id}`))),
        cta: one ? openTask : { label: `See ${firstName(editor)}'s work`, url },
        secondary: messageEditor(editor_id ?? tasks[0].assignee_id, editor),
      };
    }

    case "task_due_tomorrow":
    case "task_due_today": {
      if (!task) break;
      const when = n.type === "task_due_today" ? "today" : "tomorrow";
      return {
        ...base,
        heading: `“${task.title}” is due ${when}`,
        intro: isAssignee
          ? `Hi ${first}, a heads-up: this one's due ${when === "today" ? "by the end of today" : "tomorrow"} and it's ${status(task.status)}. Hand it in for review when it's ready.`
          : task.assignee
            ? `${task.assignee} has it, and it's still ${status(task.status)}. It isn't in review yet.`
            : "Nobody's on it yet. Assign it so it doesn't slip.",
        card: taskCard(task, today, { withAssignee: !isAssignee, withStatus: true }),
        cta: openTask,
        secondary: isAssignee ? undefined : messageEditor(task.assignee_id, task.assignee),
      };
    }

    case "task_overdue":
      if (!task) break;
      return {
        ...base,
        heading: `“${task.title}” is overdue`,
        intro: isAssignee
          ? `Hi ${first}, this was due ${task.due_date ? formatDay(task.due_date, { weekday: "long", month: "short", day: "numeric" }) : "earlier"} and it's still ${status(task.status)}. If you need more time, let the admins know in Messages.`
          : `It was due ${task.due_date ? formatDay(task.due_date, { weekday: "long", month: "short", day: "numeric" }) : "earlier"} and it's still ${status(task.status)}${
              task.assignee ? ` with ${task.assignee}` : ", with nobody on it"
            }.`,
        card: taskCard(task, today, { withAssignee: !isAssignee, withStatus: true }),
        cta: openTask,
        secondary: isAssignee
          ? { label: "Message the admins", url: data.link("/messages/team") }
          : messageEditor(task.assignee_id, task.assignee),
      };

    case "task_for_review":
      if (!task) break;
      return {
        ...base,
        heading: task.is_trial
          ? `${task.assignee ?? "A new editor"}'s test edit is ready`
          : `${task.assignee ?? "Your editor"} handed in “${task.title}”`,
        intro: task.is_trial ? "Watch it, then pass it or ask for changes." : "It's waiting for your review.",
        card: taskCard(task, today),
        cta: { label: "Review it", url },
      };

    case "revision_requested": {
      if (!task) break;
      const comment = data.comments.get(n.id);
      return {
        ...base,
        heading: `Changes requested on “${task.title}”`,
        intro: `Hi ${first}, the ${n.workspace_name} team looked at your work and asked for a few changes.`,
        quotes: comment ? quoted([comment], n.timezone) : undefined,
        card: comment ? undefined : taskCard(task, today),
        outro: "Make the changes, then move it back to For Review.",
        cta: { label: "See the feedback", url },
      };
    }

    case "task_approved": {
      if (!task) break;
      // The body ends with "<admin> marked it done" (or "Marked done").
      const by = n.body?.split(" · ").at(-1);
      return {
        ...base,
        heading: `Nice work: “${task.title}” is approved`,
        intro: `Hi ${first}, ${by && by !== "Marked done" ? by : "it's been marked done"}. Thanks for the great work.`,
        card: taskCard(task, today),
        cta: { label: "See what's next", url: data.link("/my-tasks") },
      };
    }

    case "mention": {
      const comment = data.comments.get(n.id);
      return {
        ...base,
        heading: n.title,
        quotes: comment ? quoted([comment], n.timezone) : n.body ? [{ author: n.title.split(" mentioned")[0], body: n.body }] : undefined,
        card: task && !comment ? taskCard(task, today) : undefined,
        cta: { label: "Reply on the task", url },
      };
    }

    case "new_message": {
      const from = n.title.replace(/^Message from /, "");
      const thread = n.entity_id ? data.messages.get(n.entity_id) : undefined;
      return {
        ...base,
        eyebrow: "New message",
        heading: `${from} sent you a message`,
        quotes: thread?.length ? quoted(thread, n.timezone) : n.body ? [{ author: from, body: n.body }] : undefined,
        cta: { label: "Reply", url },
      };
    }

    case "new_announcement":
      return { ...base, heading: n.title, intro: n.body, cta: { label: "Read it", url } };
  }

  return { ...base, heading: n.title, intro: n.body, cta: { label: ACTION[n.type] ?? "Open in ReEdit", url } };
}

// -----------------------------------------------------------------------------
// The email for one person in one workspace
// -----------------------------------------------------------------------------
export function notificationEmail(items: ClaimedNotification[], data: NotificationEmailData) {
  const [first] = items;
  const shared = {
    brand: first.workspace_name,
    accent: first.accent,
    timeZone: first.timezone,
    settingsUrl: data.link("/settings"),
    footnote: `You're getting this because something in ${first.workspace_name} needed you while you were away from ReEdit.`,
  };

  if (items.length === 1) {
    const content = single(first, data);
    return { subject: first.title, ...renderEmail({ ...shared, ...content }) };
  }

  const today = todayIn(first.timezone);
  const shown = items.slice(0, 12);
  const { html, text } = renderEmail({
    ...shared,
    eyebrow: "While you were away",
    heading: `${items.length} updates in ${first.workspace_name}`,
    intro: `Hi ${firstName(first.full_name)}, here's what needs you:`,
    items: shown.map((n) => {
      const task = n.entity_type === "task" && n.entity_id ? data.tasks.get(n.entity_id) : undefined;
      return {
        label:
          n.type === "task_start_reminder" ? `Reminder ${Math.min(meta(n).reminder ?? 1, 2)} of 2` : (LABEL[n.type] ?? "Update"),
        tone: TONE[n.type] ?? "accent",
        title: n.title,
        text: task && n.type === "task_assigned" ? [task.project, task.due_date && dueLabel(task.due_date, today)].filter(Boolean).join(" · ") : n.body,
        url: data.link(n.link ?? "/dashboard"),
      };
    }),
    outro: items.length > shown.length ? `And ${items.length - shown.length} more in the app.` : null,
    cta: { label: "Open ReEdit", url: data.link("/dashboard") },
  });
  return { subject: `${items.length} updates in ${first.workspace_name}`, html, text };
}
