"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, SendIcon } from "lucide-react";
import { FormRow, submitWith } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendTestEdit } from "../actions";

/**
 * Sends the test edit brief. The link defaults to the one used last time,
 * since most applicants get the same test.
 */
export function SendTestDialog({
  applicant,
  defaultUrl,
  open,
  onOpenChange,
  title,
  description,
}: {
  applicant: { id: string; name: string; email: string; testEditUrl: string | null };
  defaultUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [send, setSend] = React.useState(true);

  const submit = (formData: FormData) =>
    startTransition(async () => {
      formData.set("send", String(send));
      const result = await sendTestEdit(applicant.id, formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(result.data.emailed ? `Test edit sent to ${applicant.name}` : "Test edit link saved");
      setErrors({});
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{title ?? `Send ${applicant.name} a test edit`}</DialogTitle>
          <DialogDescription>
            {description ??
              "They get the brief and a personal link to send their edit back. When they do, the card moves to Test Submitted."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitWith(submit)} className="grid gap-4">
          <FormRow label="Test brief and footage" required hint="A Drive or Frame.io folder they can open." error={errors.test_edit_url}>
            <Input
              name="test_edit_url"
              type="url"
              placeholder="https://drive.google.com/…"
              defaultValue={applicant.testEditUrl ?? defaultUrl ?? ""}
              aria-invalid={!!errors.test_edit_url}
              required
              autoFocus
            />
          </FormRow>
          <FormRow label="Note (optional)" hint="Deadline, format, anything specific to them." error={errors.note}>
            <Textarea name="note" rows={3} className="rounded-xl" placeholder="e.g. Please send it back within 3 days." />
          </FormRow>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <Checkbox checked={send} onCheckedChange={(checked) => setSend(checked === true)} />
            Email it to {applicant.email}
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {title ? "Not now" : "Cancel"}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
              {send ? "Send test edit" : "Save link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
