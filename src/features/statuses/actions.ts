"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { TaskStatus } from "@/features/tasks/constants";
import { fail, fieldErrorsOf, type ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Constants } from "@/types/database";
import { STATUS_COLOR_KEYS, STATUS_NAME_MAX, type StatusDef, type StatusKind } from "./constants";
import { getStatusesInUse, type StatusInUse } from "./queries";

/**
 * Owners and admins manage the workspace's task and project statuses. RLS
 * lets them add and edit; reordering goes through reorder_statuses (the whole
 * list at once) and removing through delete_*_status, which moves what's in
 * the status first.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

const kindSchema = z.enum(["task", "project"]);
const idSchema = z.uuid();
const STAGES = { task: Constants.public.Enums.task_status, project: Constants.public.Enums.project_status };

/**
 * The status table for a kind. Both tables have the same columns and only the
 * stage enum differs; stages are checked against the right enum before they
 * get here. (A fresh builder per query: builders keep their filters.)
 */
const taskStatuses = (supabase: Supabase) => supabase.from("task_statuses");
const statusTable = (supabase: Supabase, kind: StatusKind) =>
  kind === "task" ? taskStatuses(supabase) : (supabase.from("project_statuses") as unknown as ReturnType<typeof taskStatuses>);

/** Statuses show up on every page with tasks or projects. */
const revalidateStatuses = () => revalidatePath("/", "layout");

const valid = (kind: StatusKind, id: string | null) =>
  kindSchema.safeParse(kind).success && (id === null || idSchema.safeParse(id).success);

/** The statuses with how much is in each, for the status editor. */
export async function loadStatuses(kind: StatusKind): Promise<ActionResult<StatusInUse<StatusDef>[]>> {
  await requirePermission("statuses.manage");
  if (!valid(kind, null)) return fail("Invalid status.");
  try {
    return { ok: true, data: await getStatusesInUse(kind) };
  } catch {
    return fail("Couldn't load the statuses. Try again.");
  }
}

/** Adds a status (id null) or saves changes to one. A new one goes after the last status of its stage. */
export async function saveStatus(kind: StatusKind, id: string | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requirePermission("statuses.manage");
  if (!valid(kind, id)) return fail("Invalid status.");
  const parsed = z
    .object({
      name: z
        .string()
        .trim()
        .min(1, "Give the status a name.")
        .max(STATUS_NAME_MAX, `Use up to ${STATUS_NAME_MAX} characters.`),
      color: z.enum(STATUS_COLOR_KEYS, "Pick a colour."),
      stage: z.enum(STAGES[kind], "Pick a stage."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { name, color } = parsed.data;
  const stage = parsed.data.stage as TaskStatus;

  const supabase = await createClient();
  const row = { name, color, stage, ...(!id && { position: await afterStage(supabase, kind, stage) }) };
  const { data, error } = id
    ? await statusTable(supabase, kind).update(row).eq("id", id).select("id").maybeSingle()
    : await statusTable(supabase, kind).insert(row).select("id").single();
  if (error) {
    if (error.code === "23505") return fail(`There's already a status called ${name}.`, { name: "That name is taken." });
    return fail(error.message);
  }
  if (!data) return fail("That status no longer exists. Refresh and try again.");

  revalidateStatuses();
  return { ok: true, data: { id: data.id } };
}

/** A position just after the last status of the stage (before whatever follows it). */
async function afterStage(supabase: Supabase, kind: StatusKind, stage: TaskStatus) {
  const { data: last } = await statusTable(supabase, kind)
    .select("position")
    .eq("stage", stage)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) {
    const { data: end } = await statusTable(supabase, kind).select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    return (end?.position ?? 0) + 1;
  }
  const { data: next } = await statusTable(supabase, kind)
    .select("position")
    .gt("position", last.position)
    .order("position")
    .limit(1)
    .maybeSingle();
  return next ? (last.position + next.position) / 2 : last.position + 1;
}

/** Saves a new order: every status of the kind, first to last. */
export async function reorderStatuses(kind: StatusKind, ids: string[]): Promise<ActionResult> {
  await requirePermission("statuses.manage");
  const parsed = z.object({ kind: kindSchema, ids: z.array(idSchema).min(1).max(200) }).safeParse({ kind, ids });
  if (!parsed.success) return fail("Invalid order.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_statuses", { p_kind: parsed.data.kind, p_ids: parsed.data.ids });
  if (error) return fail(error.message);

  revalidateStatuses();
  return { ok: true };
}

/** Removes a status. Whatever is in it moves to `moveTo`, another status of the same stage. */
export async function removeStatus(kind: StatusKind, id: string, moveTo: string | null): Promise<ActionResult> {
  await requirePermission("statuses.manage");
  if (!valid(kind, id) || (moveTo !== null && !idSchema.safeParse(moveTo).success)) return fail("Invalid status.");

  const supabase = await createClient();
  const args = { p_status_id: id, p_move_to: moveTo ?? undefined };
  const { error } =
    kind === "task" ? await supabase.rpc("delete_task_status", args) : await supabase.rpc("delete_project_status", args);
  if (error) return fail(error.message);

  revalidateStatuses();
  return { ok: true };
}
