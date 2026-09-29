"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { CheckboxChips, FieldGroup, FormRow, submitWith } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SOFTWARE_OPTIONS, SPECIALTY_OPTIONS } from "@/features/applicants/constants";
import { updateEditorDetails } from "../../actions";
import { WEEKDAYS } from "../../constants";

export type EditorDetails = {
  software: string[];
  specialties: string[];
  hourlyRate: number | null;
  weeklyHours: number | null;
  workDays: number[];
  shiftStart: string;
};

export function EditorDetailsDialog({
  open,
  onOpenChange,
  editorId,
  details,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editorId: string;
  details: EditorDetails;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await updateEditorDetails(editorId, formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success("Details saved");
      setErrors({});
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit details</DialogTitle>
          <DialogDescription>Skills, rate and their usual weekly schedule.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submitWith(submit)} className="grid max-h-[70vh] gap-5 overflow-y-auto pr-1 sm:grid-cols-2">
          <FieldGroup label="Software" error={errors.software} className="sm:col-span-2">
            <CheckboxChips name="software" options={SOFTWARE_OPTIONS} defaultValue={details.software} />
          </FieldGroup>
          <FieldGroup label="Specialties" error={errors.specialties} className="sm:col-span-2">
            <CheckboxChips name="specialties" options={SPECIALTY_OPTIONS} defaultValue={details.specialties} />
          </FieldGroup>
          <FormRow label="Hourly rate (USD)" error={errors.hourly_rate}>
            <Input name="hourly_rate" type="number" min={0} step="0.5" defaultValue={details.hourlyRate ?? ""} />
          </FormRow>
          <FormRow label="Hours per week" error={errors.weekly_hours}>
            <Input name="weekly_hours" type="number" min={0} max={168} defaultValue={details.weeklyHours ?? ""} />
          </FormRow>
          <FieldGroup label="Work days" error={errors.work_days}>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => (
                <label key={day.value} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="work_days"
                    value={day.value}
                    defaultChecked={details.workDays.includes(day.value)}
                    className="peer sr-only"
                  />
                  <span className="inline-flex h-8 w-11 items-center justify-center rounded-full border text-sm text-muted-foreground transition-colors select-none peer-checked:border-primary/60 peer-checked:bg-primary/12 peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                    {day.short}
                  </span>
                </label>
              ))}
            </div>
          </FieldGroup>
          <FormRow label="Usual start time" hint="In their timezone." error={errors.shift_start}>
            <Input name="shift_start" type="time" defaultValue={details.shiftStart.slice(0, 5)} required />
          </FormRow>
          <p className="self-end text-xs text-muted-foreground">
            Their timezone and phone number are part of their own account. They change them in Settings.
          </p>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Save details
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
