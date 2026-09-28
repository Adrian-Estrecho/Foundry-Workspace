"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { FieldGroup, FormRow, NativeSelect, submitWith } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTask, updateTask } from "../actions";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "../constants";
import type { TaskFormOptions } from "../queries";
import { TaskStatusChip } from "./task-bits";

export type TaskDraft = {
  id?: string;
  title?: string;
  description?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
};

/**
 * New task, or edit one (when `task.id` is set). Opened from the task views,
 * a project page, a calendar day or an editor's column, each pre-filling
 * what it knows.
 */
export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskDraft;
  options: TaskFormOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const editing = Boolean(task.id);

  // Inactive editors and delivered projects only show up if the task already uses them.
  const editors = options.editors.filter((e) => e.isActive || e.id === task.assigneeId);
  const projects = options.projects.filter((p) => !p.delivered || p.id === task.projectId);
  const byClient = new Map<string, typeof projects>();
  for (const project of projects) byClient.set(project.clientName, [...(byClient.get(project.clientName) ?? []), project]);

  const submit = (formData: FormData) =>
    startTransition(async () => {
      if (editing) {
        const result = await updateTask(task.id!, formData);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          return void toast.error(result.error);
        }
        toast.success("Task updated");
      } else {
        const result = await createTask(formData);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          return void toast.error(result.error);
        }
        const id = result.data.id;
        toast.success("Task created", {
          description: String(formData.get("title")),
          action: { label: "Open", onClick: () => router.push(`/tasks/${id}`) },
        });
      }
      setErrors({});
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{editing ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {editing ? "Changes are saved for everyone straight away." : "The editor is notified as soon as it's assigned."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormRow label="Title" required error={errors.title} className="sm:col-span-2">
            <Input
              name="title"
              defaultValue={task.title ?? ""}
              placeholder="e.g. Reel 06 · rough cut"
              autoFocus
              required
              aria-invalid={!!errors.title}
            />
          </FormRow>

          <FormRow label="Project" error={errors.project_id}>
            <NativeSelect name="project_id" defaultValue={task.projectId ?? ""}>
              <option value="">No project (internal)</option>
              {[...byClient.entries()].map(([client, list]) => (
                <optgroup key={client} label={client}>
                  {list.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                      {project.delivered ? " (delivered)" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </NativeSelect>
          </FormRow>
          <FormRow label="Assignee" error={errors.assignee_id}>
            <NativeSelect name="assignee_id" defaultValue={task.assigneeId ?? ""}>
              <option value="">Unassigned</option>
              {editors.map((editor) => (
                <option key={editor.id} value={editor.id}>
                  {editor.name}
                  {editor.isActive ? "" : " (inactive)"}
                </option>
              ))}
            </NativeSelect>
          </FormRow>

          <FormRow label="Due date" error={errors.due_date}>
            <Input name="due_date" type="date" defaultValue={task.dueDate ?? ""} aria-invalid={!!errors.due_date} />
          </FormRow>
          {editing ? (
            // Status changes from the status menu, so saving here never undoes a move made meanwhile.
            <div className="grid content-start gap-2">
              <span className="text-sm font-medium">Status</span>
              <span className="flex h-10 items-center">
                <TaskStatusChip status={task.status ?? "todo"} />
              </span>
              <span className="text-xs text-muted-foreground">Change it from the status menu on the task.</span>
            </div>
          ) : (
            <FormRow label="Status" error={errors.status}>
              <NativeSelect name="status" defaultValue={task.status ?? "todo"}>
                {TASK_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </NativeSelect>
            </FormRow>
          )}

          <FieldGroup label="Priority" error={errors.priority} className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">
              {[...TASK_PRIORITIES].reverse().map((priority) => (
                <label key={priority.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    value={priority.value}
                    defaultChecked={(task.priority ?? "medium") === priority.value}
                    className="peer sr-only"
                  />
                  <span className="inline-flex h-8 items-center rounded-full border px-3 text-sm text-muted-foreground transition-colors select-none peer-checked:border-primary/60 peer-checked:bg-primary/12 peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:text-foreground">
                    {priority.label}
                  </span>
                </label>
              ))}
            </div>
          </FieldGroup>

          <FormRow label="Description" error={errors.description} className="sm:col-span-2">
            <Textarea
              name="description"
              rows={4}
              defaultValue={task.description ?? ""}
              placeholder="What to make, where the footage is, anything the editor should know…"
              className="rounded-xl"
            />
          </FormRow>

          {!editing && (
            <FormRow label="Subtasks" hint="One per line. Editors tick them off as they go." className="sm:col-span-2">
              <Textarea name="subtasks" rows={3} placeholder={"Pull selects\nRough assembly\nCaptions"} className="rounded-xl" />
            </FormRow>
          )}

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {editing ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
