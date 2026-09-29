"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { AccentPicker } from "@/components/theme/accent-picker";
import { FormRow, submitWith } from "@/components/shared/form";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Workspace } from "@/lib/auth";
import { updateWorkspace } from "./actions";

export function WorkspaceForm({ workspace, siteUrl }: { workspace: Workspace; siteUrl: string }) {
  const router = useRouter();
  const [accent, setAccent] = React.useState(workspace.default_accent);
  const [slug, setSlug] = React.useState(workspace.slug);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await updateWorkspace(formData);
      if (result.ok) {
        setFieldErrors({});
        toast.success("Workspace settings saved");
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });

  const host = siteUrl.replace(/^https?:\/\//, "");

  return (
    <Panel title="General" description="Name, public links, onboarding resources and defaults.">
      <form onSubmit={submitWith(save)} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormRow label="Workspace name" error={fieldErrors.name}>
          <Input name="name" defaultValue={workspace.name} maxLength={60} required />
        </FormRow>
        <FormRow
          label="Link name"
          error={fieldErrors.slug}
          hint={
            <>
              Your public forms: {host}/apply/<span className="text-foreground">{slug || "…"}</span> and /intake/
              <span className="text-foreground">{slug || "…"}</span>. Changing it breaks links you&apos;ve shared.
            </>
          }
        >
          <Input
            name="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            maxLength={40}
            autoCapitalize="off"
            spellCheck={false}
            required
          />
        </FormRow>
        <label className="flex items-start justify-between gap-4 rounded-lg bg-surface p-4 ring-1 ring-border sm:col-span-2">
          <span>
            <span className="block text-sm font-medium">Accepting applications</span>
            <span className="block text-xs text-muted-foreground">
              When off, your application link shows that you aren&apos;t hiring right now.
            </span>
          </span>
          <Switch name="accepting_applications" defaultChecked={workspace.accepting_applications} />
        </label>
        <FormRow label="Editor asset pack (Drive link)" error={fieldErrors.asset_pack_url}>
          <Input name="asset_pack_url" type="url" defaultValue={workspace.asset_pack_url ?? ""} placeholder="https://drive.google.com/…" />
        </FormRow>
        <FormRow label="Frame.io workspace invite link" error={fieldErrors.frameio_invite_url}>
          <Input
            name="frameio_invite_url"
            type="url"
            defaultValue={workspace.frameio_invite_url ?? ""}
            placeholder="https://app.frame.io/…"
          />
        </FormRow>
        <FormRow
          label="Editor contract and NDA (Drive link)"
          error={fieldErrors.contract_template_url}
          hint="New editors download, sign and upload these during onboarding."
        >
          <Input
            name="contract_template_url"
            type="url"
            defaultValue={workspace.contract_template_url ?? ""}
            placeholder="https://drive.google.com/…"
          />
        </FormRow>
        <FormRow
          label="Missed start alert (minutes)"
          error={fieldErrors.missed_clock_in_grace_minutes}
          hint="Alert when an editor hasn't started this long after their shift start."
        >
          <Input
            name="missed_clock_in_grace_minutes"
            type="number"
            min={0}
            max={720}
            defaultValue={workspace.missed_clock_in_grace_minutes}
          />
        </FormRow>
        <div className="grid gap-3 sm:col-span-2">
          <p className="text-sm font-medium">Default accent colour</p>
          <p className="-mt-2 text-xs text-muted-foreground">
            Used on your public forms, and for anyone here who hasn&apos;t picked their own.
          </p>
          <AccentPicker name="default_accent" value={accent} onChange={setAccent} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Save workspace settings
          </Button>
        </div>
      </form>
    </Panel>
  );
}
