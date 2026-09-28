"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateCallNotes } from "../../actions";

/** Discovery-call and kickoff notes. Ctrl/⌘ + Enter saves. */
export function NotesPanel({ clientId, notes }: { clientId: string; notes: string | null }) {
  const [value, setValue] = React.useState(notes ?? "");
  const [saved, setSaved] = React.useState(notes ?? "");
  const [pending, startTransition] = React.useTransition();
  const dirty = value !== saved;

  const save = () =>
    startTransition(async () => {
      const result = await updateCallNotes(clientId, value);
      if (!result.ok) return void toast.error(result.error);
      setSaved(value);
      toast.success("Notes saved");
    });

  return (
    <Panel
      title="Call notes"
      description="What was discussed on calls: goals, style, deliverables, next steps."
      action={
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {dirty ? "Save" : "Saved"}
        </Button>
      }
    >
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && dirty) {
            e.preventDefault();
            save();
          }
        }}
        rows={7}
        placeholder="Nothing yet. Add notes from your discovery call…"
        aria-label="Call notes"
        className="min-h-40 rounded-2xl bg-surface"
      />
    </Panel>
  );
}
