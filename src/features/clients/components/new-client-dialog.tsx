"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { FormRow, NativeSelect, submitWith } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClientRecord } from "../actions";
import { BUDGET_RANGES, CLIENT_STAGES, PROJECT_TYPES } from "../constants";

/** Add a client by hand (referral, repeat customer). */
export function NewClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await createClientRecord(formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Client added");
      setErrors({});
      onOpenChange(false);
      router.push(`/clients/${result.data.id}`);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">New client</DialogTitle>
          <DialogDescription>For clients who didn&apos;t come through the intake form.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submitWith(submit)} className="grid gap-4 sm:grid-cols-2">
          <FormRow label="Contact name" required error={errors.contact_name}>
            <Input name="contact_name" autoFocus required aria-invalid={!!errors.contact_name} />
          </FormRow>
          <FormRow label="Company" error={errors.company}>
            <Input name="company" />
          </FormRow>
          <FormRow label="Email" error={errors.email}>
            <Input name="email" type="email" aria-invalid={!!errors.email} />
          </FormRow>
          <FormRow label="Phone" error={errors.phone}>
            <Input name="phone" type="tel" />
          </FormRow>
          <FormRow label="Project type">
            <NativeSelect name="project_type" defaultValue="">
              <option value="">—</option>
              {PROJECT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </NativeSelect>
          </FormRow>
          <FormRow label="Budget">
            <NativeSelect name="budget_range" defaultValue="">
              <option value="">—</option>
              {BUDGET_RANGES.map((range) => (
                <option key={range}>{range}</option>
              ))}
            </NativeSelect>
          </FormRow>
          <FormRow label="Deadline" error={errors.deadline}>
            <Input name="deadline" type="date" />
          </FormRow>
          <FormRow label="Start in stage">
            <NativeSelect name="stage" defaultValue="new_lead">
              {CLIENT_STAGES.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </NativeSelect>
          </FormRow>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Add client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
