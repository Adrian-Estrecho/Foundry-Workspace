import * as React from "react";
import type { Json } from "@/types/database";

/**
 * Renders an SOP's rich-text document (Tiptap/ProseMirror JSON) as React
 * elements, so nothing is injected as raw HTML. Covers the common nodes;
 * anything unknown falls back to its text.
 */

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = { type?: string; text?: string; marks?: Mark[]; attrs?: Record<string, unknown>; content?: Node[] };

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null && !Array.isArray(value);
const safeHref = (href: unknown) => (typeof href === "string" && /^(https?:|mailto:)/i.test(href) ? href : undefined);

function renderText(node: Node, key: React.Key) {
  let element: React.ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") element = <strong>{element}</strong>;
    else if (mark.type === "italic") element = <em>{element}</em>;
    else if (mark.type === "underline") element = <u>{element}</u>;
    else if (mark.type === "strike") element = <s>{element}</s>;
    else if (mark.type === "code") element = <code className="rounded bg-muted px-1 py-0.5 text-[0.9em]">{element}</code>;
    else if (mark.type === "link" && safeHref(mark.attrs?.href)) {
      element = (
        <a href={safeHref(mark.attrs?.href)} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
          {element}
        </a>
      );
    }
  }
  return <React.Fragment key={key}>{element}</React.Fragment>;
}

function renderNode(node: Node, key: React.Key): React.ReactNode {
  const children = (node.content ?? []).map((child, index) => renderNode(child, index));
  switch (node.type) {
    case "doc":
      return <React.Fragment key={key}>{children}</React.Fragment>;
    case "text":
      return renderText(node, key);
    case "paragraph":
      return <p key={key}>{children.length ? children : <br />}</p>;
    case "heading": {
      const level = Number(node.attrs?.level) || 2;
      return level <= 2 ? (
        <h3 key={key} className="font-heading text-lg font-medium">
          {children}
        </h3>
      ) : (
        <h4 key={key} className="font-medium">
          {children}
        </h4>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className="list-disc pl-5">
          {children}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="list-decimal pl-5">
          {children}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return (
        <blockquote key={key} className="border-l-2 border-primary/50 pl-4 text-muted-foreground">
          {children}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre key={key} className="overflow-x-auto rounded-lg bg-muted p-3 text-sm">
          <code>{children}</code>
        </pre>
      );
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} className="border-border" />;
    default:
      return <React.Fragment key={key}>{children}</React.Fragment>;
  }
}

export function SopContent({ content }: { content: Json }) {
  if (!isNode(content) || !content.content?.length) {
    return <p className="text-sm text-muted-foreground">This SOP is empty.</p>;
  }
  return <div className="grid gap-3 text-sm leading-relaxed">{renderNode(content as Node, "doc")}</div>;
}
