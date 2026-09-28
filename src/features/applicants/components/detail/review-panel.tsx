"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { setApplicantRating, updateApplicantNotes } from "../../actions";
import { StarPicker } from "../star-rating";

/** Rating and private notes. Ctrl/⌘ + Enter saves the notes. */
export function ReviewPanel({ applicantId, rating, notes }: { applicantId: string; rating: number | null; notes: string | null }) {
  const router = useRouter();
  const [stars, setStars] = React.useOptimistic(rating);
  const [value, setValue] = React.useState(notes ?? "");
  const [saved, setSaved] = React.useState(notes ?? "");
  const [pending, startTransition] = React.useTransition();
  const [, startRating] = React.useTransition();
  const dirty = value !== saved;

  const rate = (next: number | null) =>
    startRating(async () => {
      setStars(next);
      const result = await setApplicantRating(applicantId, next);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });

  const save = () =>
    startTransition(async () => {
      const result = await updateApplicantNotes(applicantId, value);
      if (!result.ok) return void toast.error(result.error);
      setSaved(value);
      toast.success("Notes saved");
    });

  return (
    <Panel
      title="Your review"
      description="Only admins see this."
      action={
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {dirty ? "Save notes" : "Saved"}
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StarPicker value={stars} onChange={rate} />
        <span className="text-sm text-muted-foreground tabular">{stars ? `${stars} / 5` : "Not rated"}</span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && dirty) {
            e.preventDefault();
            save();
          }
        }}
        rows={6}
        placeholder="Portfolio impressions, test edit feedback, interview notes…"
        aria-label="Admin notes"
        className="min-h-36 rounded-2xl bg-surface"
      />
    </Panel>
  );
}
