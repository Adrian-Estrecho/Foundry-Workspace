"use client";

import { useActionState } from "react";
import { AlertCircleIcon, Loader2Icon, SendIcon } from "lucide-react";
import { FormRow } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitTestEdit, type TestEditState } from "./actions";

export function TestEditForm({
  applicantId,
  signature,
  previousUrl,
}: {
  applicantId: string;
  signature: string;
  previousUrl: string | null;
}) {
  const [state, action, pending] = useActionState<TestEditState, FormData>(submitTestEdit, undefined);

  return (
    <form key={state?.url ?? "initial"} action={action} className="grid gap-5 rounded-xl border bg-card p-6 sm:p-8" noValidate>
      <input type="hidden" name="a" value={applicantId} />
      <input type="hidden" name="s" value={signature} />
      <FormRow
        label="Link to your edit"
        required
        hint="Frame.io, Vimeo, Google Drive or unlisted YouTube. Make sure anyone with the link can watch it."
      >
        <Input
          name="url"
          type="url"
          placeholder="https://"
          defaultValue={state?.url ?? previousUrl ?? ""}
          aria-invalid={!!state?.error}
          required
          autoFocus
        />
      </FormRow>

      {state?.error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger ring-1 ring-danger/25">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="justify-self-start">
        {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
        {previousUrl ? "Send new link" : "Send my edit"}
      </Button>
    </form>
  );
}
