"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { FormRow, NativeSelect } from "@/components/shared/form";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfile, type ActionResult } from "./actions";

export function ProfileForm({
  fullName,
  email,
  phone,
  timezone,
  timeZones,
}: {
  fullName: string;
  email: string;
  phone: string | null;
  timezone: string;
  /** From the server, so the option list matches during hydration. */
  timeZones: string[];
}) {
  const [state, action, pending] = useActionState(async (prev: ActionResult | undefined, formData: FormData) => {
    const result = await updateProfile(prev, formData);
    if (result.ok) toast.success(result.message);
    else toast.error(result.error);
    return result;
  }, undefined);

  return (
    <Panel title="Profile" description="How you appear to the rest of the team.">
      <form action={action} className="grid gap-5 sm:grid-cols-2">
        <FormRow label="Full name">
          <Input name="full_name" defaultValue={fullName} required autoComplete="name" />
        </FormRow>
        <FormRow label="Email" hint="Ask an admin to change your email.">
          <Input value={email} disabled readOnly />
        </FormRow>
        <FormRow label="Phone">
          <Input name="phone" defaultValue={phone ?? ""} autoComplete="tel" placeholder="+1 555 0100" />
        </FormRow>
        <FormRow label="Timezone" hint="Deadlines and 'today' use this timezone.">
          <NativeSelect name="timezone" defaultValue={timezone}>
            {(timeZones.includes(timezone) ? timeZones : [timezone, ...timeZones]).map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </NativeSelect>
        </FormRow>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Save profile
          </Button>
          {state && !state.ok && <span className="ml-3 text-sm text-danger">{state.error}</span>}
        </div>
      </form>
    </Panel>
  );
}
