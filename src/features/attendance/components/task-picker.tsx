"use client";

import { CircleDashedIcon, Loader2Icon } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { shortDue } from "@/features/tasks/components/task-bits";
import { cn } from "@/lib/utils";
import type { PickableTask } from "./use-my-tasks";

/**
 * Searchable list of the editor's open tasks, plus "No specific task" for
 * time that isn't on one (calls, admin, learning).
 */
export function TaskPicker({
  tasks,
  today,
  currentId,
  onPick,
  disabled,
}: {
  tasks: PickableTask[] | null;
  today: string;
  currentId?: string | null;
  onPick: (taskId: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <Command className="rounded-lg! p-0">
      <CommandInput placeholder="Find a task…" autoFocus />
      <CommandList className="max-h-64">
        {tasks === null ? (
          <div className="grid place-items-center py-6 text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
          </div>
        ) : (
          <>
            <CommandEmpty>No open tasks match.</CommandEmpty>
            {tasks.length > 0 && (
              <CommandGroup heading="Your open tasks">
                {tasks.map((task) => (
                  <CommandItem
                    key={task.id}
                    value={`${task.title} ${task.projectName ?? ""} ${task.id}`}
                    disabled={disabled}
                    data-checked={task.id === currentId}
                    onSelect={() => onPick(task.id)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{task.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{task.projectName ?? "Internal"}</span>
                    </span>
                    {task.dueDate && (
                      <span className={cn("shrink-0 text-xs tabular", task.dueDate < today ? "text-danger" : "text-muted-foreground")}>
                        {shortDue(task.dueDate, today)}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup>
              <CommandItem value="no specific task" disabled={disabled} data-checked={currentId === null} onSelect={() => onPick(null)}>
                <CircleDashedIcon className="text-muted-foreground" />
                No specific task
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );
}
