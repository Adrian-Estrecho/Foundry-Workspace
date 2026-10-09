import {
  BadgeCheckIcon,
  BanIcon,
  CompassIcon,
  InfoIcon,
  LightbulbIcon,
  StarIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import type { Json } from "@/types/database";

/**
 * The SOP document's own blocks, shared by the editor and the reader.
 * Content is Tiptap/ProseMirror JSON: on top of the usual text nodes it can
 * hold `steps` > `step` (a numbered step-by-step), `taskList` > `taskItem`
 * (a checklist) and `callout` boxes with one of the variants below.
 */

export const CALLOUT_VARIANTS = ["note", "tip", "guideline", "important", "warning", "do", "dont"] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

export const CALLOUT_INFO: Record<CalloutVariant, { label: string; description: string; placeholder: string; icon: LucideIcon }> = {
  note: { label: "Note", description: "Extra context worth knowing", placeholder: "Write a note", icon: InfoIcon },
  tip: { label: "Tip", description: "A shortcut or better way", placeholder: "Share a tip", icon: LightbulbIcon },
  guideline: { label: "Guideline", description: "The standard to follow", placeholder: "State the standard", icon: CompassIcon },
  important: { label: "Important", description: "Don't skip this", placeholder: "What nobody should miss", icon: StarIcon },
  warning: { label: "Warning", description: "What can go wrong", placeholder: "What can go wrong, and how to avoid it", icon: TriangleAlertIcon },
  do: { label: "Do", description: "The right way", placeholder: "What to do", icon: BadgeCheckIcon },
  dont: { label: "Don't", description: "Mistakes to avoid", placeholder: "What to avoid", icon: BanIcon },
};

export const calloutVariant = (value: unknown): CalloutVariant =>
  CALLOUT_VARIANTS.includes(value as CalloutVariant) ? (value as CalloutVariant) : "note";

type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; content?: Node[] };

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null && !Array.isArray(value);

/** A node's plain text, with blocks separated by a space. */
export function textOf(node: Node): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return " ";
  const inline = node.content?.some((child) => child.type === "text");
  return (node.content ?? []).map(textOf).join(inline ? "" : " ");
}

export type OutlineEntry = { id: string; level: 2 | 3; text: string };

/**
 * The document's headings in order, with the ids SopContent gives them
 * (`sop-h-0`, `sop-h-1`, … counted over every heading, empty ones too).
 */
export function outlineOf(content: Json): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  let index = 0;
  const walk = (node: Node) => {
    if (node.type === "heading") {
      const id = `sop-h-${index++}`;
      const text = textOf(node).trim();
      if (text) entries.push({ id, level: Number(node.attrs?.level) >= 3 ? 3 : 2, text });
      return;
    }
    node.content?.forEach(walk);
  };
  if (isNode(content)) walk(content);
  return entries;
}

/** Minutes to read it, at an unhurried 200 words a minute. */
export function readingMinutes(content: Json) {
  if (!isNode(content)) return 1;
  const words = textOf(content).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
