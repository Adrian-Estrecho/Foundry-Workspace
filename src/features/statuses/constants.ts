/**
 * Workspace statuses. Each workspace names its own task and project
 * statuses; every status belongs to a stage (the fixed task_status /
 * project_status values), and the stage decides how it behaves: who may move
 * work there, what counts as finished, what clients see.
 */

/** Colours a status can have. Full class names, so Tailwind keeps them. */
export const STATUS_COLORS = {
  grey: { label: "Grey", dot: "bg-muted-foreground", chip: "bg-muted text-muted-foreground ring-border" },
  blue: { label: "Blue", dot: "bg-status-online", chip: "bg-status-online/12 text-status-online ring-status-online/25" },
  teal: { label: "Teal", dot: "bg-teal-500", chip: "bg-teal-500/12 text-teal-700 ring-teal-500/25 dark:text-teal-300" },
  green: { label: "Green", dot: "bg-success", chip: "bg-success/12 text-success ring-success/25" },
  yellow: { label: "Yellow", dot: "bg-warning", chip: "bg-warning/12 text-warning ring-warning/25" },
  orange: { label: "Orange", dot: "bg-orange-500", chip: "bg-orange-500/12 text-orange-700 ring-orange-500/25 dark:text-orange-300" },
  red: { label: "Red", dot: "bg-danger", chip: "bg-danger/10 text-danger ring-danger/25" },
  pink: { label: "Pink", dot: "bg-pink-500", chip: "bg-pink-500/12 text-pink-700 ring-pink-500/25 dark:text-pink-300" },
  purple: { label: "Purple", dot: "bg-violet-500", chip: "bg-violet-500/12 text-violet-700 ring-violet-500/25 dark:text-violet-300" },
  accent: { label: "Accent", dot: "bg-primary", chip: "bg-primary/12 text-primary ring-primary/25" },
} as const;

export type StatusColor = keyof typeof STATUS_COLORS;
export const STATUS_COLOR_KEYS = Object.keys(STATUS_COLORS) as [StatusColor, ...StatusColor[]];

export const statusColor = (color: string) => STATUS_COLORS[color as StatusColor] ?? STATUS_COLORS.grey;

/** A workspace status, as boards, menus and the settings list need it. */
export type StatusDef<Stage extends string = string> = {
  id: string;
  name: string;
  color: StatusColor;
  stage: Stage;
  position: number;
};

/** Enough to draw a status chip. */
export type StatusBadge = { id: string; name: string; color: StatusColor };

/** A fixed stage: what it's called and what it means. */
export type StageInfo<Stage extends string = string> = { value: Stage; label: string; hint: string };

export type StatusKind = "task" | "project";

export const STATUS_NAME_MAX = 40;
