"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { FormRow, NativeSelect, submitWith } from "@/components/shared/form";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createProject, updateProject } from "../actions";
import { ASPECT_SUGGESTIONS, FORMAT_SUGGESTIONS, LENGTH_SUGGESTIONS, type ProjectStatus } from "../constants";

export type EditorOption = { id: string; name: string; avatarUrl: string | null };
export type ClientChoice = { id: string; name: string; driveFolderUrl: string | null; deadline?: string | null };

/** An existing project, for editing. */
export type ProjectEditable = {
  id: string;
  clientId: string;
  name: string;
  status: ProjectStatus;
  deadline: string | null;
  driveFolderUrl: string | null;
  frameioUrl: string | null;
  specFormat: string | null;
  specAspectRatio: string | null;
  specLength: string | null;
  specNotes: string | null;
  team: (EditorOption & { isActive?: boolean })[];
};

/**
 * New project for a client, or edit one. For a new project the client is
 * either fixed (Kickoff prompt, client page) or chosen here (Projects page).
 */
export function ProjectFormDialog({
  open,
  onOpenChange,
  client,
  clients,
  project,
  editors,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientChoice;
  clients?: ClientChoice[];
  project?: ProjectEditable;
  editors: EditorOption[];
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [clientId, setClientId] = React.useState(project?.clientId ?? client?.id ?? "");
  const driveInput = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const editing = Boolean(project);
  const chosen = client ?? clients?.find((c) => c.id === clientId);

  // Keep current team members selectable even if they're now inactive.
  const people = [
    ...editors,
    ...(project?.team.filter((member) => !editors.some((e) => e.id === member.id)) ?? []),
  ];
  const onTeam = new Set(project?.team.map((member) => member.id));

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = editing ? await updateProject(project!.id, formData) : await createProject(formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      const projectId = result.projectId;
      toast.success(editing ? "Project saved" : "Project created", {
        description: `${formData.get("name")}${chosen ? ` · ${chosen.name}` : ""}`,
        action: editing ? undefined : { label: "Open", onClick: () => router.push(`/projects/${projectId}`) },
      });
      setErrors({});
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{title ?? (editing ? "Edit project" : "New project")}</DialogTitle>
          <DialogDescription>
            {description ?? (editing ? "Changes apply straight away." : chosen ? `A new project for ${chosen.name}.` : "Pick the client it's for.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {client && !editing ? (
            <input type="hidden" name="client_id" value={client.id} />
          ) : (
            <FormRow label="Client" required error={errors.client_id} className="sm:col-span-2">
              <NativeSelect
                name="client_id"
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                  const next = clients?.find((c) => c.id === event.target.value);
                  if (driveInput.current && !driveInput.current.value && next?.driveFolderUrl) {
                    driveInput.current.value = next.driveFolderUrl;
                  }
                }}
                required
                aria-invalid={!!errors.client_id}
              >
                <option value="" disabled>
                  Choose a client
                </option>
                {(clients ?? (client ? [client] : [])).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </FormRow>
          )}

          <FormRow label="Project name" required error={errors.name} className="sm:col-span-2">
            <Input
              name="name"
              defaultValue={project?.name ?? ""}
              placeholder="e.g. Q1 Reels Package"
              autoFocus={!editing}
              required
              aria-invalid={!!errors.name}
            />
          </FormRow>
          <FormRow label="Deadline" error={errors.deadline}>
            <Input name="deadline" type="date" defaultValue={project?.deadline ?? client?.deadline ?? ""} />
          </FormRow>
          <FormRow label="Google Drive folder" error={errors.drive_folder_url}>
            <Input
              ref={driveInput}
              name="drive_folder_url"
              type="url"
              defaultValue={project?.driveFolderUrl ?? client?.driveFolderUrl ?? ""}
              placeholder="https://drive.google.com/…"
            />
          </FormRow>
          <FormRow label="Frame.io review link" error={errors.frameio_url} className="sm:col-span-2">
            <Input name="frameio_url" type="url" defaultValue={project?.frameioUrl ?? ""} placeholder="https://app.frame.io/…" />
          </FormRow>

          <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
            <legend className="mb-3 text-sm font-medium">Deliverable specs</legend>
            <FormRow label="Format">
              <Input name="spec_format" list={`${id}-format`} defaultValue={project?.specFormat ?? ""} placeholder="MP4 H.264" />
            </FormRow>
            <FormRow label="Aspect ratio">
              <Input name="spec_aspect_ratio" list={`${id}-aspect`} defaultValue={project?.specAspectRatio ?? ""} placeholder="9:16" />
            </FormRow>
            <FormRow label="Length">
              <Input name="spec_length" list={`${id}-length`} defaultValue={project?.specLength ?? ""} placeholder="30–60s" />
            </FormRow>
            <datalist id={`${id}-format`}>{FORMAT_SUGGESTIONS.map((v) => <option key={v} value={v} />)}</datalist>
            <datalist id={`${id}-aspect`}>{ASPECT_SUGGESTIONS.map((v) => <option key={v} value={v} />)}</datalist>
            <datalist id={`${id}-length`}>{LENGTH_SUGGESTIONS.map((v) => <option key={v} value={v} />)}</datalist>
          </fieldset>

          <fieldset className="sm:col-span-2">
            <legend className="mb-3 text-sm font-medium">Editors</legend>
            {/* The team as the form saw it, so saving only removes people unticked here. */}
            {project?.team.map((member) => <input key={member.id} type="hidden" name="team_before" value={member.id} />)}
            {people.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active editors yet. You can assign them later.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {people.map((editor) => (
                  <label
                    key={editor.id}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface p-2.5 ring-1 ring-border has-data-[state=checked]:ring-primary/60"
                  >
                    <Checkbox name="editor_ids" value={editor.id} defaultChecked={onTeam.has(editor.id)} />
                    <UserAvatar name={editor.name} src={editor.avatarUrl} className="size-8" />
                    <span className="truncate text-sm font-medium">{editor.name}</span>
                  </label>
                ))}
              </div>
            )}
            {editing && <p className="mt-2 text-xs text-muted-foreground">Editors given a task on this project join the team automatically.</p>}
          </fieldset>

          <FormRow label="Notes" className="sm:col-span-2">
            <Textarea
              name="spec_notes"
              rows={3}
              defaultValue={project?.specNotes ?? ""}
              placeholder="Brand guidelines, music, captions…"
              className="rounded-xl"
            />
          </FormRow>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {editing ? "Cancel" : "Not now"}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {editing ? "Save project" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
