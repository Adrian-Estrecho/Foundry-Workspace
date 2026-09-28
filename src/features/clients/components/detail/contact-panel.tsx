"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BriefcaseBusinessIcon, CalendarIcon, Loader2Icon, MailIcon, PencilIcon, PhoneIcon, UserIcon, WalletIcon } from "lucide-react";
import { FormRow, NativeSelect, submitWith } from "@/components/shared/form";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDay } from "@/lib/dates";
import { updateClientContact } from "../../actions";
import { BUDGET_RANGES, PROJECT_TYPES } from "../../constants";

type Contact = {
  contact_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  project_type: string | null;
  budget_range: string | null;
  deadline: string | null;
};

export function ContactPanel({ clientId, contact }: { clientId: string; contact: Contact }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await updateClientContact(clientId, formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.error);
      }
      toast.success("Contact details saved");
      setErrors({});
      setOpen(false);
      router.refresh();
    });

  // Free-text values from older records still show up in the selects.
  const withCurrent = (options: string[], current: string | null) =>
    current && !options.includes(current) ? [current, ...options] : options;

  const rows = [
    { icon: UserIcon, label: "Contact", value: contact.contact_name },
    { icon: BriefcaseBusinessIcon, label: "Company", value: contact.company },
    {
      icon: MailIcon,
      label: "Email",
      value: contact.email && (
        <a href={`mailto:${contact.email}`} className="hover:text-primary">
          {contact.email}
        </a>
      ),
    },
    {
      icon: PhoneIcon,
      label: "Phone",
      value: contact.phone && (
        <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:text-primary">
          {contact.phone}
        </a>
      ),
    },
    { icon: WalletIcon, label: "Budget", value: contact.budget_range },
    { icon: CalendarIcon, label: "Deadline", value: contact.deadline && formatDay(contact.deadline, { month: "short", day: "numeric", year: "numeric" }) },
  ];

  return (
    <Panel
      title="Contact"
      description={contact.project_type ?? undefined}
      action={
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <PencilIcon /> Edit
        </Button>
      }
    >
      <dl className="grid gap-3">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-strong ring-1 ring-border">
              <Icon className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="truncate text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
            </div>
          </div>
        ))}
      </dl>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitWith(save)} className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Contact name" required error={errors.contact_name}>
              <Input name="contact_name" defaultValue={contact.contact_name} required />
            </FormRow>
            <FormRow label="Company" error={errors.company}>
              <Input name="company" defaultValue={contact.company ?? ""} />
            </FormRow>
            <FormRow label="Email" error={errors.email}>
              <Input name="email" type="email" defaultValue={contact.email ?? ""} />
            </FormRow>
            <FormRow label="Phone" error={errors.phone}>
              <Input name="phone" type="tel" defaultValue={contact.phone ?? ""} />
            </FormRow>
            <FormRow label="Project type">
              <NativeSelect name="project_type" defaultValue={contact.project_type ?? ""}>
                <option value="">—</option>
                {withCurrent(PROJECT_TYPES, contact.project_type).map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </NativeSelect>
            </FormRow>
            <FormRow label="Budget">
              <NativeSelect name="budget_range" defaultValue={contact.budget_range ?? ""}>
                <option value="">—</option>
                {withCurrent(BUDGET_RANGES, contact.budget_range).map((range) => (
                  <option key={range}>{range}</option>
                ))}
              </NativeSelect>
            </FormRow>
            <FormRow label="Deadline" error={errors.deadline}>
              <Input name="deadline" type="date" defaultValue={contact.deadline ?? ""} />
            </FormRow>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2Icon className="animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
