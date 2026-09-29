import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeFields, type FormKind } from "./fields";

/** The current workspace's forms, for the builder and the Workspace page. */
export async function getWorkspaceForms() {
  const supabase = await createClient();
  const { data } = await supabase.from("workspace_forms").select("kind, fields, updated_at");
  const row = (kind: FormKind) => data?.find((r) => r.kind === kind);
  const form = (kind: FormKind) => ({
    fields: normalizeFields(kind, row(kind)?.fields),
    updatedAt: row(kind)?.updated_at ?? null,
  });
  return { apply: form("apply"), intake: form("intake") };
}

/**
 * A workspace's form for its public page and for checking what that page
 * sends. Read with the service role: visitors aren't signed in. Falls back to
 * the default form when there's no saved one (or it can't be read).
 */
export const getPublicForm = cache(async (workspaceId: string, kind: FormKind) => {
  const { data } = await createAdminClient()
    .from("workspace_forms")
    .select("fields")
    .eq("workspace_id", workspaceId)
    .eq("kind", kind)
    .maybeSingle();
  return normalizeFields(kind, data?.fields);
});
