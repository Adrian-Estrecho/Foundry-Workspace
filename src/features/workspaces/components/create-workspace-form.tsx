"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { FormRow } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createWorkspace } from "../actions";
import { slugify } from "../constants";

/** Name the workspace; its link name follows the name until edited by hand. */
export function CreateWorkspaceForm({ host }: { host: string }) {
  const [state, action, pending] = useActionState(createWorkspace, undefined);
  const [name, setName] = React.useState(state?.values?.name ?? "");
  const [slug, setSlug] = React.useState(state?.values?.slug ?? "");
  const [slugEdited, setSlugEdited] = React.useState(false);
  const shownSlug = slugEdited ? slug : slugify(name);

  return (
    <form action={action} className="grid gap-4">
      <FormRow label="Workspace name" error={state?.fieldErrors?.name} hint="Usually your company or studio name.">
        <Input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Northwind Studio"
          maxLength={60}
          className="h-11 bg-surface"
          required
        />
      </FormRow>
      <FormRow
        label="Link name"
        error={state?.fieldErrors?.slug}
        hint={
          <>
            Your application link: {host}/apply/<span className="text-foreground">{shownSlug || "…"}</span>
          </>
        }
      >
        <Input
          name="slug"
          value={shownSlug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
          }}
          maxLength={40}
          autoCapitalize="off"
          spellCheck={false}
          className="h-11 bg-surface"
          required
        />
      </FormRow>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
        Create workspace
      </Button>
    </form>
  );
}
