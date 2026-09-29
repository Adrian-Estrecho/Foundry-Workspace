"use client";

import * as React from "react";
import { toast } from "sonner";
import { LockIcon, Loader2Icon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/dates";
import { saveEditorNotes } from "../../review-actions";

/** Admin-only notes about an editor: test edit impressions, interview notes. */
export function NotesPanel({
  editorId,
  notes,
  renderedAt,
}: {
  editorId: string;
  notes: { body: string; updated_at: string } | null;
  renderedAt: number;
}) {
  const [body, setBody] = React.useState(notes?.body ?? "");
  const [saved, setSaved] = React.useState(notes?.body ?? "");
  const [pending, startTransition] = React.useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await saveEditorNotes(editorId, body);
      if (!result.ok) return void toast.error(result.error);
      setSaved(body);
      toast.success("Notes saved");
    });

  return (
    <Panel
      title="Private notes"
      description={notes?.updated_at ? `Updated ${timeAgo(notes.updated_at, renderedAt)}` : "Only owners and admins see these."}
      action={<LockIcon className="size-4 text-muted-foreground" aria-label="Private" />}
    >
      <div className="grid gap-3">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          maxLength={8000}
          placeholder="Test edit impressions, interview notes, anything to remember…"
          aria-label="Private notes"
          className="rounded-xl"
        />
        <Button onClick={save} disabled={pending || body === saved} className="justify-self-start" variant="secondary">
          {pending && <Loader2Icon className="animate-spin" />}
          Save notes
        </Button>
      </div>
    </Panel>
  );
}
