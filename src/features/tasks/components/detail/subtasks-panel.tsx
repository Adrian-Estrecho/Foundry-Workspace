"use client";

import * as React from "react";
import { toast } from "sonner";
import { ListChecksIcon, PlusIcon, XIcon } from "lucide-react";
import { EmptyState, Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addSubtask, deleteSubtask, toggleSubtask } from "../../actions";

type Subtask = { id: string; title: string; is_done: boolean };
type Change = { type: "add"; title: string } | { type: "toggle"; id: string; done: boolean } | { type: "delete"; id: string };

/** Checklist inside a task. Ticks, additions and removals show straight away. */
export function SubtasksPanel({ taskId, subtasks, canEdit }: { taskId: string; subtasks: Subtask[]; canEdit: boolean }) {
  const [title, setTitle] = React.useState("");
  const [, startTransition] = React.useTransition();
  const [items, apply] = React.useOptimistic(subtasks, (list, change: Change) => {
    if (change.type === "add") return [...list, { id: `new-${list.length}`, title: change.title, is_done: false }];
    if (change.type === "toggle") return list.map((s) => (s.id === change.id ? { ...s, is_done: change.done } : s));
    return list.filter((s) => s.id !== change.id);
  });
  const done = items.filter((s) => s.is_done).length;

  const run = (change: Change, action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      apply(change);
      const result = await action();
      if (!result.ok) toast.error(result.error);
    });

  const add = () => {
    const value = title.trim();
    if (!value) return;
    setTitle("");
    run({ type: "add", title: value }, () => addSubtask(taskId, value));
  };

  return (
    <Panel
      title="Subtasks"
      description={items.length ? `${done} of ${items.length} done` : undefined}
    >
      {items.length > 0 && (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div
            className={cn("h-full rounded-full transition-[width]", done === items.length ? "bg-success" : "bg-primary")}
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
      )}

      {items.length === 0 && !canEdit ? (
        <EmptyState icon={ListChecksIcon} title="No subtasks" />
      ) : (
        <ul className="grid grid-cols-1 gap-1">
          {items.map((subtask) => {
            const pending = subtask.id.startsWith("new-");
            return (
              <li key={subtask.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/40">
                <Checkbox
                  checked={subtask.is_done}
                  disabled={!canEdit || pending}
                  onCheckedChange={(checked) =>
                    run({ type: "toggle", id: subtask.id, done: checked === true }, () => toggleSubtask(subtask.id, checked === true))
                  }
                  aria-label={subtask.title}
                />
                <span className={cn("min-w-0 flex-1 text-sm break-words", subtask.is_done && "text-muted-foreground line-through")}>
                  {subtask.title}
                </span>
                {canEdit && !pending && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-full text-muted-foreground opacity-100 group-hover:opacity-100 focus-visible:opacity-100 sm:opacity-0"
                    aria-label={`Remove ${subtask.title}`}
                    onClick={() => run({ type: "delete", id: subtask.id }, () => deleteSubtask(subtask.id))}
                  >
                    <XIcon />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a subtask"
            aria-label="New subtask"
            maxLength={200}
            className="h-9"
          />
          <Button type="submit" variant="secondary" className="bg-surface-strong ring-1 ring-border" disabled={!title.trim()}>
            <PlusIcon /> Add
          </Button>
        </form>
      )}
    </Panel>
  );
}
