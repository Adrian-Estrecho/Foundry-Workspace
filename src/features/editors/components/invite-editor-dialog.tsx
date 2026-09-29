"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, SendIcon } from "lucide-react";
import { FormRow, submitWith } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { inviteEditor } from "@/features/invitations/actions";
import { formatInviteCode } from "@/features/invitations/constants";

/** Invite an editor directly (someone you already work with), skipping the application. */
export function InviteEditorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
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
      toast.success("Invitation sent", {
        description: `Code ${formatInviteCode(result.data.code)} is on its way to ${formData.get("email")}`,
      });
      setErrors({});
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Invite an editor</DialogTitle>
          <DialogDescription>
            For editors you already work with. We&apos;ll email them an invitation code. They sign up (or sign in), enter it,
            and start onboarding.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Full name" required error={errors.full_name}>
            <Input name="full_name" autoFocus required aria-invalid={!!errors.full_name} />
          </FormRow>
          <FormRow label="Email" required error={errors.email}>
            <Input name="email" type="email" required aria-invalid={!!errors.email} />
          </FormRow>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
