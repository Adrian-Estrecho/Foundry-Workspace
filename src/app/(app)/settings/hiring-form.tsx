"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { FormRow, submitWith } from "@/components/shared/form";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateHiring } from "./actions";

type TestTemplate = { test_title: string | null; test_brief: string | null; test_asset_url: string | null; test_due_days: number };

/** The test edit every new editor gets when they join (admins only). */
export function HiringForm({ template }: { template: TestTemplate | null }) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await updateHiring(formData);
      if (result.ok) {
        setFieldErrors({});
        toast.success("Test edit saved");
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });

  return (
    <Panel
      id="hiring"
      title="Test edit"
      description="Given to every editor when they join with an invitation, due a few days later. Leave the title empty to assign one by hand from their profile."
    >
      <form onSubmit={submitWith(save)} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormRow label="Title" error={fieldErrors.test_title} className="sm:col-span-2">
          <Input
            name="test_title"
            defaultValue={template?.test_title ?? ""}
            placeholder="Test edit · 30s product teaser"
            maxLength={120}
          />
        </FormRow>
        <FormRow label="Brief" hint="What to make, format and length, what you're looking for." error={fieldErrors.test_brief} className="sm:col-span-2">
          <Textarea name="test_brief" rows={5} maxLength={4000} defaultValue={template?.test_brief ?? ""} className="rounded-xl" />
        </FormRow>
        <FormRow label="Footage and assets (link)" error={fieldErrors.test_asset_url}>
          <Input
            name="test_asset_url"
            type="url"
            defaultValue={template?.test_asset_url ?? ""}
            placeholder="https://drive.google.com/…"
          />
        </FormRow>
        <FormRow label="Due after (days)" error={fieldErrors.test_due_days}>
          <Input name="test_due_days" type="number" min={1} max={30} defaultValue={template?.test_due_days ?? 3} />
        </FormRow>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Save test edit
          </Button>
        </div>
      </form>
    </Panel>
  );
}
