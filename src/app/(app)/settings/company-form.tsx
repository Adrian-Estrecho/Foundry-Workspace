"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { AccentPicker } from "@/components/theme/accent-picker";
import { FormRow } from "@/components/shared/form";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/types/database";
import { updateCompany, type ActionResult } from "./actions";

export function CompanyForm({ settings }: { settings: Tables<"app_settings"> }) {
  const router = useRouter();
  const [accent, setAccent] = React.useState(settings.default_accent);
  const [state, action, pending] = useActionState(async (prev: ActionResult | undefined, formData: FormData) => {
    const result = await updateCompany(prev, formData);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    return result;
  }, undefined);

  return (
    <Panel title="Company" description="Admin only. Applies to everyone at Foundry.">
      <form action={action} className="grid gap-5 sm:grid-cols-2">
        <FormRow label="Company name">
          <Input name="company_name" defaultValue={settings.company_name} required />
        </FormRow>
        <FormRow label="Admin notification email" hint="New leads and applicants are emailed here.">
          <Input name="admin_email" type="email" defaultValue={settings.admin_email ?? ""} />
        </FormRow>
        <FormRow label="Editor asset pack (Drive link)">
          <Input name="asset_pack_url" type="url" defaultValue={settings.asset_pack_url ?? ""} placeholder="https://drive.google.com/…" />
        </FormRow>
        <FormRow label="Frame.io workspace invite link">
          <Input name="frameio_invite_url" type="url" defaultValue={settings.frameio_invite_url ?? ""} placeholder="https://app.frame.io/…" />
        </FormRow>
        <FormRow label="Editor contract and NDA (Drive link)" hint="New editors download, sign and upload these during onboarding.">
          <Input
            name="contract_template_url"
            type="url"
            defaultValue={settings.contract_template_url ?? ""}
            placeholder="https://drive.google.com/…"
          />
        </FormRow>
        <FormRow label="Missed start alert (minutes)" hint="Alert when an editor hasn't started this long after their shift start.">
          <Input
            name="missed_clock_in_grace_minutes"
            type="number"
            min={0}
            max={720}
            defaultValue={settings.missed_clock_in_grace_minutes}
          />
        </FormRow>
        <div className="grid gap-3 sm:col-span-2">
          <p className="text-sm font-medium">Default accent colour</p>
          <p className="-mt-2 text-xs text-muted-foreground">
            Used on the login and public forms, and for anyone who hasn&apos;t picked their own.
          </p>
          <AccentPicker name="default_accent" value={accent} onChange={setAccent} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Save company settings
          </Button>
          {state && !state.ok && <span className="ml-3 text-sm text-danger">{state.error}</span>}
        </div>
      </form>
    </Panel>
  );
}
