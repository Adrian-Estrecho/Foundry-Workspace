"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { TaskStatus } from "@/features/tasks/constants";
import { fail, fieldErrorsOf, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Constants } from "@/types/database";
import { STATUS_COLOR_KEYS, STATUS_NAME_MAX, type StatusKind } from "./constants";

/**
 * Owners and admins manage the workspace's task and project statuses. RLS
 * lets them add and edit; removing goes through delete_*_status, which moves
 * what's in the status first.
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

/** Adds a status (id null) or saves changes to one. New ones go at the end of their stage. */
export async function saveStatus(kind: StatusKind, id: string | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
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
  let position: number | undefined;
  if (id) {
    const { data: current } = await statusTable(supabase, kind).select("stage").eq("id", id).maybeSingle();
    if (!current) return fail("That status no longer exists. Refresh and try again.");
    if (current.stage !== stage) position = await endOfStage(supabase, kind, stage);
  } else {
    position = await endOfStage(supabase, kind, stage);
  }

  const row = { name, color, stage, ...(position !== undefined && { position }) };
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

async function endOfStage(supabase: Supabase, kind: StatusKind, stage: TaskStatus) {
  const { data } = await statusTable(supabase, kind)
    .select("position")
    .eq("stage", stage)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

/** Moves a status one place up (-1) or down (1) within its stage. */
export async function moveStatus(kind: StatusKind, id: string, direction: -1 | 1): Promise<ActionResult> {
  await requireAdmin();
  if (!valid(kind, id) || (direction !== -1 && direction !== 1)) return fail("Invalid move.");

  const supabase = await createClient();
  const { data: status } = await statusTable(supabase, kind).select("stage").eq("id", id).maybeSingle();
  if (!status) return fail("That status no longer exists. Refresh and try again.");
  const { data: siblings, error: readError } = await statusTable(supabase, kind)
    .select("id, position")
    .eq("stage", status.stage)
    .order("position")
    .order("created_at");
  if (readError) return fail(readError.message);

  const order = siblings.map((s) => s.id);
  const from = order.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return { ok: true };
  [order[from], order[to]] = [order[to], order[from]];

  // Renumber the stage 1, 2, 3… so statuses with equal positions still move.
  const was = new Map(siblings.map((s) => [s.id, s.position]));
  const results = await Promise.all(
    order
      .map((statusId, index) => ({ statusId, position: index + 1 }))
      .filter(({ statusId, position }) => was.get(statusId) !== position)
      .map(({ statusId, position }) => statusTable(supabase, kind).update({ position }).eq("id", statusId)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return fail(failed.error.message);

  revalidateStatuses();
  return { ok: true };
}

/** Removes a status. Whatever is in it moves to `moveTo`, another status of the same stage. */
export async function removeStatus(kind: StatusKind, id: string, moveTo: string | null): Promise<ActionResult> {
  await requireAdmin();
  if (!valid(kind, id) || (moveTo !== null && !idSchema.safeParse(moveTo).success)) return fail("Invalid status.");

  const supabase = await createClient();
  const args = { p_status_id: id, p_move_to: moveTo ?? undefined };
  const { error } =
    kind === "task" ? await supabase.rpc("delete_task_status", args) : await supabase.rpc("delete_project_status", args);
  if (error) return fail(error.message);

  revalidateStatuses();
  return { ok: true };
}
