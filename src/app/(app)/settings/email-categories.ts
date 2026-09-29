/**
 * Email settings, matching notification_email_category() in
 * 0014_notifications.sql (and the check on profiles.email_muted).
 */
export const EMAIL_CATEGORIES = [
  {
    value: "tasks",
    label: "Tasks",
    admin: "Work ready for review, overdue tasks and @mentions.",
    editor: "New tasks, changes requested, due tomorrow, overdue and @mentions.",
    roles: ["admin", "editor"],
  },
  {
    value: "messages",
    label: "Messages",
    admin: "New messages from editors and clients.",
    editor: "Replies from the admins.",
    roles: ["admin", "editor"],
  },
  {
    value: "announcements",
    label: "Announcements",
    admin: "Announcements other admins post.",
    editor: "New announcements for the team.",
    roles: ["admin", "editor"],
  },
  {
    value: "attendance",
    label: "Attendance",
    admin: "Missed starts, blockers in end-of-shift reports, and editors gone quiet with work overdue.",
    editor: "When an admin ends a shift you left running.",
    roles: ["admin", "editor"],
  },
  {
    value: "team",
    label: "Team and onboarding",
    admin: "People joining with an invitation, and editors ready for your approval.",
    editor: "",
    roles: ["admin"],
  },
] as const satisfies readonly { value: string; label: string; admin: string; editor: string; roles: readonly ("admin" | "editor")[] }[];

export type EmailCategory = (typeof EMAIL_CATEGORIES)[number]["value"];
