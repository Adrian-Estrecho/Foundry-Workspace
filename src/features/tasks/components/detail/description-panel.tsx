"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { MentionText } from "@/components/shared/mention-textarea";
import { Panel } from "@/components/shared/panel";
import { cn } from "@/lib/utils";

/** Longer than this starts folded. */
const FOLD_LINES = 14;
const FOLD_CHARS = 900;

/** The brief, with its links clickable. A long one (ClickUp scripts) starts folded. */
export function DescriptionPanel({ description, emptyText }: { description: string | null; emptyText: string }) {
  const long = !!description && (description.split("\n").length > FOLD_LINES || description.length > FOLD_CHARS);
  const [expanded, setExpanded] = React.useState(false);
  const folded = long && !expanded;

  return (
    <Panel title="Description">
      {description ? (
        <>
          <p className={cn("text-sm leading-relaxed break-words whitespace-pre-line", folded && "max-h-72 overflow-hidden")}>
            <MentionText text={description} names={[]} />
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border hover:text-foreground"
            >
              <ChevronDownIcon className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
              {expanded ? "Collapse" : "Expand"}
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
    </Panel>
  );
}
