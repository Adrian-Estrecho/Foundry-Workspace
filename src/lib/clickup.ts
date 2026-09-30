import "server-only";

/**
 * A small client for ClickUp's REST API (v2), authenticated with a personal
 * API token. Only the parts the pipeline sync uses are typed.
 */

const API = "https://api.clickup.com/api/v2";

export type ClickUpStatus = { status: string; type: string; orderindex: number; color: string };
export type ClickUpUser = { id: number; username: string | null; email: string | null };
/** `members` are full members; guests aren't listed. */
export type ClickUpTeam = { id: string; name: string; members?: { user: ClickUpUser }[] };
export type ClickUpList = { id: string; name: string; task_count?: number | null; statuses?: ClickUpStatus[] };
export type ClickUpFolder = { id: string; name: string; lists: ClickUpList[] };
export type ClickUpSpace = { id: string; name: string };
export type ClickUpTask = {
  id: string;
  name: string;
  text_content: string | null;
  status: ClickUpStatus;
  priority: { priority: string } | null;
  due_date: string | null;
  assignees: ClickUpUser[];
  archived: boolean;
  /** Set on subtasks, which aren't synced. */
  parent: string | null;
  list: { id: string; name: string };
};
/** Fields the sync changes with Update Task. Priority is 1 (urgent) to 4 (low); due_date is epoch ms. */
export type ClickUpTaskUpdate = {
  name?: string;
  /** Plain text. A single space clears it. */
  description?: string;
  status?: string;
  priority?: number | null;
  due_date?: number | null;
  due_date_time?: boolean;
  assignees?: { add: number[]; rem: number[] };
};
export type ClickUpWebhook = {
  id: string;
  endpoint: string;
  secret?: string;
  health?: { status: string; fail_count: number };
};

export class ClickUpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ClickUpError";
  }
}

/** Events the sync listens to. */
export const WEBHOOK_EVENTS = [
  "taskCreated",
  "taskUpdated",
  "taskDeleted",
  "taskStatusUpdated",
  "taskAssigneeUpdated",
  "taskDueDateUpdated",
  "taskPriorityUpdated",
  "taskMoved",
  "listUpdated",
];

export const clickupTaskUrl = (taskId: string) => `https://app.clickup.com/t/${taskId}`;

type Query = Record<string, string | number | boolean | undefined>;

/** A client for one token. When ClickUp's rate limit is hit, it waits for the reset once and retries. */
export function clickup(token: string) {
  async function request<T>(method: string, path: string, query?: Query, body?: unknown, retried = false): Promise<T> {
    const url = new URL(API + path);
    for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) url.searchParams.set(key, String(value));

    const response = await fetch(url, {
      method,
      headers: { Authorization: token, ...(body !== undefined && { "Content-Type": "application/json" }) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    if (response.status === 429 && !retried) {
      // The reset is in epoch seconds.
      const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
      const wait = Number.isFinite(reset) ? Math.min(Math.max(reset - Date.now(), 1000), 20_000) : 5000;
      await new Promise((resolve) => setTimeout(resolve, wait));
      return request<T>(method, path, query, body, true);
    }

    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const message = (json as { err?: string } | null)?.err;
      throw new ClickUpError(message ? `ClickUp: ${message}` : `ClickUp answered ${response.status}.`, response.status);
    }
    return json as T;
  }

  return {
    user: () => request<{ user: ClickUpUser & { timezone?: string | null } }>("GET", "/user").then((r) => r.user),
    teams: () => request<{ teams: ClickUpTeam[] }>("GET", "/team").then((r) => r.teams),
    spaces: (teamId: string) =>
      request<{ spaces: ClickUpSpace[] }>("GET", `/team/${teamId}/space`, { archived: false }).then((r) => r.spaces),
    folders: (spaceId: string) =>
      request<{ folders: ClickUpFolder[] }>("GET", `/space/${spaceId}/folder`, { archived: false }).then((r) => r.folders),
    folderlessLists: (spaceId: string) =>
      request<{ lists: ClickUpList[] }>("GET", `/space/${spaceId}/list`, { archived: false }).then((r) => r.lists),
    list: (listId: string) => request<ClickUpList & { statuses: ClickUpStatus[] }>("GET", `/list/${listId}`),
    /** One page (up to 100) of a List's tasks, closed ones included, without subtasks. */
    listTasks: (listId: string, page: number) =>
      request<{ tasks: ClickUpTask[]; last_page?: boolean }>("GET", `/list/${listId}/task`, {
        page,
        include_closed: true,
        subtasks: false,
      }),
    task: (taskId: string) => request<ClickUpTask>("GET", `/task/${taskId}`),
    updateTask: (taskId: string, changes: ClickUpTaskUpdate) => request<ClickUpTask>("PUT", `/task/${taskId}`, undefined, changes),
    /** People with access to the List itself (not through its Folder, Space or workspace). */
    listMembers: (listId: string) => request<{ members: ClickUpUser[] }>("GET", `/list/${listId}/member`).then((r) => r.members),
    createWebhook: (teamId: string, endpoint: string) =>
      request<{ id: string; webhook: ClickUpWebhook }>("POST", `/team/${teamId}/webhook`, undefined, {
        endpoint,
        events: WEBHOOK_EVENTS,
      }),
    webhooks: (teamId: string) =>
      request<{ webhooks: ClickUpWebhook[] }>("GET", `/team/${teamId}/webhook`).then((r) => r.webhooks),
    deleteWebhook: (webhookId: string) => request<unknown>("DELETE", `/webhook/${webhookId}`),
  };
}

export type ClickUpClient = ReturnType<typeof clickup>;
