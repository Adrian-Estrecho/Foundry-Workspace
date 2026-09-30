"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, PlugIcon } from "lucide-react";
import { FormRow, NativeSelect, submitWith } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectClickUp } from "../actions";

/** Paste a personal API token (and, when it reaches several ClickUp workspaces, pick one). */
export function ConnectForm({ submitLabel = "Connect ClickUp", onDone }: { submitLabel?: string; onDone?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [teams, setTeams] = React.useState<{ id: string; name: string }[] | null>(null);

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await connectClickUp(formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      if (result.data.teams) {
        setTeams(result.data.teams);
        return;
      }
      setErrors({});
      toast.success("ClickUp connected", { description: "Now link a List to bring its tasks in." });
      onDone?.();
      router.refresh();
    });

  return (
    <form onSubmit={submitWith(submit)} className="grid gap-4">
      <FormRow
        label="API token"
        error={errors.token}
        hint="Starts with pk_. ReEdit keeps it on the server and only uses it to talk to ClickUp."
      >
        <Input
          name="token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="pk_…"
          aria-invalid={!!errors.token}
          required
        />
      </FormRow>
      {teams && (
        <FormRow label="ClickUp workspace" hint="This token can see more than one. Pick the one to sync.">
          <NativeSelect name="team_id" defaultValue={teams[0]?.id}>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </NativeSelect>
        </FormRow>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <PlugIcon />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
