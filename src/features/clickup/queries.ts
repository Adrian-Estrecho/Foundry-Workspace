import "server-only";
import type { StatusBadge, StatusColor } from "@/features/statuses/constants";
import type { TaskStatus } from "@/features/tasks/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, loadConnection, type ListStatus } from "./sync";

/** Whether ClickUp is sending changes: registered and healthy, failing, or not set up (no public address yet). */
export type LiveUpdates = { state: "on" | "failing" | "off"; detail: string | null };

export type PipelineRow = {
  id: string;
  listId: string;
  listName: string;
  project: { id: string; name: string } | null;
  startStatus: string;
  statuses: ListStatus[];
  tasks: number;
  lastSyncedAt: string | null;
};

export type StatusLink = { clickupStatus: string; status: StatusBadge & { stage: TaskStatus }; needsReview: boolean };

/** Everything the ClickUp page shows. Admins only (RLS). */
export async function getClickUpPage(workspaceId: string) {
  const supabase = await createClient();
  const [{ data: connection }, { data: pipelines }, { data: links }, { data: projects }, { data: clients }] = await Promise.all([
    supabase
      .from("clickup_connections")
      .select("team_id, team_name, account_name, account_email, webhook_id, connected_at, last_event_at, last_error, last_error_at")
      .maybeSingle(),
    supabase
      .from("clickup_pipelines")
      .select("id, list_id, list_name, start_status, statuses, last_synced_at, project:projects(id, name)")
      .order("created_at"),
    supabase
      .from("clickup_status_map")
      .select("clickup_status, needs_review, status:task_statuses!clickup_status_map_workspace_id_status_id_fkey(id, name, color, stage, position)"),
    supabase.from("projects").select("id, name, client_id, status").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, company, contact_name").order("company"),
  ]);

  let counts = new Map<string, number>();
  if (pipelines?.length) {
    const { data } = await supabase
      .from("tasks")
      .select("project_id")
      .in("project_id", pipelines.map((p) => p.project?.id).filter((id): id is string => Boolean(id)))
      .not("clickup_task_id", "is", null);
    counts = (data ?? []).reduce((map, t) => map.set(t.project_id!, (map.get(t.project_id!) ?? 0) + 1), new Map<string, number>());
  }

  let live: LiveUpdates = { state: "off", detail: null };
  if (connection?.webhook_id) {
    live = { state: "on", detail: null };
    try {
      const clickup = await loadConnection(createAdminClient(), workspaceId);
      const webhook = (await clickup?.api.webhooks(connection.team_id))?.find((w) => w.id === connection.webhook_id);
      if (!webhook) live = { state: "failing", detail: "ClickUp no longer has the webhook. Connect again to restore it." };
      else if (webhook.health && webhook.health.status !== "active") {
        live = { state: "failing", detail: `ClickUp marked it ${webhook.health.status} after ${webhook.health.fail_count} failed calls.` };
      }
    } catch (error) {
      live = { state: "on", detail: `Couldn't check with ClickUp: ${errorMessage(error)}` };
    }
  }

  const linkedProjects = new Set((pipelines ?? []).map((p) => p.project?.id));
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.company?.trim() || c.contact_name]));

  return {
    renderedAt: Date.now(),
    connection: connection
      ? {
          teamName: connection.team_name,
          accountName: connection.account_name,
          accountEmail: connection.account_email,
          connectedAt: connection.connected_at,
          lastEventAt: connection.last_event_at,
          lastError: connection.last_error,
          lastErrorAt: connection.last_error_at,
        }
      : null,
    live,
    pipelines: (pipelines ?? []).map(
      (p): PipelineRow => ({
        id: p.id,
        listId: p.list_id,
        listName: p.list_name,
        project: p.project,
        startStatus: p.start_status,
        statuses: (p.statuses as ListStatus[] | null) ?? [],
        tasks: p.project ? (counts.get(p.project.id) ?? 0) : 0,
        lastSyncedAt: p.last_synced_at,
      }),
    ),
    links: [...(links ?? [])]
      .sort((a, b) => (a.status?.position ?? 0) - (b.status?.position ?? 0))
      .flatMap((l): StatusLink[] =>
        l.status
          ? [
              {
                clickupStatus: l.clickup_status,
                needsReview: l.needs_review,
                status: { id: l.status.id, name: l.status.name, color: l.status.color as StatusColor, stage: l.status.stage },
              },
            ]
          : [],
      ),
    // For the link form: projects without a List, and clients.
    projects: (projects ?? [])
      .filter((p) => !linkedProjects.has(p.id) && p.status !== "delivered")
      .map((p) => ({ id: p.id, name: p.name, clientName: clientName.get(p.client_id) ?? "Client" })),
    clients: (clients ?? []).map((c) => ({ id: c.id, name: c.company?.trim() || c.contact_name })),
  };
}

export type ClickUpPage = Awaited<ReturnType<typeof getClickUpPage>>;
