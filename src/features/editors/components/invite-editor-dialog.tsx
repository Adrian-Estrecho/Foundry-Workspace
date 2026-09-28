"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, SendIcon } from "lucide-react";
import { FormRow, NativeSelect, submitWith } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { inviteEditor } from "../actions";

/** Invite an editor directly (someone you already work with), skipping the application. */
export function InviteEditorDialog({
  open,
  onOpenChange,
  timeZones,
  defaultTimeZone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeZones: string[];
  defaultTimeZone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await inviteEditor(formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success("Invite sent", { description: `Welcome email on its way to ${formData.get("email")}` });
      setErrors({});
      onOpenChange(false);
      router.push(`/editors/${result.data.id}`);
    });

  const zones = timeZones.includes(defaultTimeZone) ? timeZones : [defaultTimeZone, ...timeZones];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Invite an editor</DialogTitle>
          <DialogDescription>
            For editors you already work with. They get a Welcome to Foundry email, choose a password and start onboarding.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitWith(submit)} className="grid gap-4 sm:grid-cols-2">
          <FormRow label="Full name" required error={errors.full_name}>
            <Input name="full_name" autoFocus required aria-invalid={!!errors.full_name} />
          </FormRow>
          <FormRow label="Email" required error={errors.email}>
            <Input name="email" type="email" required aria-invalid={!!errors.email} />
          </FormRow>
          <FormRow label="Timezone" error={errors.timezone} className="sm:col-span-2">
            <NativeSelect name="timezone" defaultValue={defaultTimeZone}>
              {zones.map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </NativeSelect>
          </FormRow>
          <FormRow label="Hourly rate (USD)" error={errors.hourly_rate}>
            <Input name="hourly_rate" type="number" min={0} step="0.5" inputMode="decimal" />
          </FormRow>
          <FormRow label="Hours per week" error={errors.weekly_hours}>
            <Input name="weekly_hours" type="number" min={0} max={168} inputMode="numeric" />
          </FormRow>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
