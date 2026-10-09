import * as React from "react";
import type { Json } from "@/types/database";
import { CALLOUT_INFO, calloutVariant, textOf } from "../blocks";

/**
 * Renders an SOP's rich-text document (Tiptap/ProseMirror JSON) as React
 * elements, so nothing is injected as raw HTML. It mirrors the editor's
 * markup, and `.sop-prose` (globals.css) styles both. Anything unknown falls
 * back to its text.
 */

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = { type?: string; text?: string; marks?: Mark[]; attrs?: Record<string, unknown>; content?: Node[] };
/** Headings are numbered as they're met, matching outlineOf(). */
type Context = { heading: number; numbers?: Map<string, string> };

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null && !Array.isArray(value);
const safeHref = (href: unknown) => (typeof href === "string" && /^(https?:|mailto:)/i.test(href) ? href : undefined);

function renderText(node: Node, key: React.Key) {
  let element: React.ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") element = <strong>{element}</strong>;
    else if (mark.type === "italic") element = <em>{element}</em>;
    else if (mark.type === "underline") element = <u>{element}</u>;
    else if (mark.type === "strike") element = <s>{element}</s>;
    else if (mark.type === "code") element = <code>{element}</code>;
    else if (mark.type === "link" && safeHref(mark.attrs?.href)) {
      element = (
        <a href={safeHref(mark.attrs?.href)} target="_blank" rel="noreferrer">
          {element}
        </a>
      );
    }
  }
  return <React.Fragment key={key}>{element}</React.Fragment>;
}

function renderNode(node: Node, key: React.Key, context: Context): React.ReactNode {
  if (node.type === "heading") {
    const id = `sop-h-${context.heading++}`;
    const number = context.numbers?.get(id);
    const Heading = Number(node.attrs?.level) >= 3 ? "h3" : "h2";
    return (
      <Heading key={key} id={id}>
        {number && <span className="sop-section-number">{number}</span>}
        {(node.content ?? []).map((child, index) => renderNode(child, index, context))}
      </Heading>
    );
  }

  // A step, checklist item or box left empty in the editor would read as a stray number or an empty box.
  if ((node.type === "step" || node.type === "taskItem" || node.type === "callout") && !textOf(node).trim()) return null;

  const children = (node.content ?? []).map((child, index) => renderNode(child, index, context));
  switch (node.type) {
    case "doc":
      return <React.Fragment key={key}>{children}</React.Fragment>;
    case "text":
      return renderText(node, key);
    case "paragraph":
      return <p key={key}>{children.length ? children : <br />}</p>;
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList": {
      const start = Number(node.attrs?.start);
      return (
        <ol key={key} start={Number.isInteger(start) && start > 1 ? start : undefined}>
          {children}
        </ol>
      );
    }
    case "listItem":
      return <li key={key}>{children}</li>;
    case "steps":
      return (
        <ol key={key} data-type="steps">
          {children}
        </ol>
      );
    case "step":
      return (
        <li key={key} data-type="step">
          {children}
        </li>
      );
    case "taskList":
      return (
        <ul key={key} data-type="taskList">
          {children}
        </ul>
      );
    case "taskItem": {
      // Readers can tick items as they go; nothing is saved.
      const checked = node.attrs?.checked === true;
      return (
        <li key={key} data-type="taskItem" data-checked={checked}>
          <label>
            <input type="checkbox" defaultChecked={checked} aria-label={textOf(node).trim() || "Checklist item"} />
          </label>
          <div>{children}</div>
        </li>
      );
    }
    case "callout": {
      const variant = calloutVariant(node.attrs?.variant);
      const { label, icon: Icon } = CALLOUT_INFO[variant];
      return (
        <aside key={key} data-type="callout" data-callout={variant} aria-label={label}>
          <div className="sop-callout-label">
            <Icon aria-hidden="true" />
            {label}
          </div>
          <div className="sop-callout-body">{children}</div>
        </aside>
      );
    }
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    default:
      return <React.Fragment key={key}>{children}</React.Fragment>;
  }
}

/** The document's blocks, for a `.sop-prose` container. `numbers` labels section headings by id. */
export function SopContent({ content, numbers }: { content: Json; numbers?: Map<string, string> }) {
  if (!isNode(content) || !textOf(content).trim()) {
    return <p className="text-muted-foreground italic">This SOP is empty.</p>;
  }
  return renderNode(content as Node, "doc", { heading: 0, numbers });
}
