import type { CurrentUser } from "@/lib/auth";

/** What someone may do on the project pages, from their abilities. */
export type ProjectAccess = {
  /** Create, edit, move and delete projects; see all their tasks. */
  manage: boolean;
  /** Edit the workspace's project statuses. */
  statuses: boolean;
  /** Open clients and share the client portal. */
  clients: boolean;
  /** Open editor profiles. */
  editors: boolean;
};

export function projectAccess(user: Pick<CurrentUser, "permissions">): ProjectAccess {
  const has = (key: CurrentUser["permissions"][number]) => user.permissions.includes(key);
  return {
    manage: has("tasks.manage"),
    statuses: has("statuses.manage"),
    clients: has("clients.manage"),
    editors: has("editors.manage"),
  };
}
