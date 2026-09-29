/** Where the portal's views live. `project` narrows to one project (not on Messages). */
export type PortalLink = { token: string; projectId: string | null };

export function portalHref(link: PortalLink, view: string, extra: { project?: string; month?: string } = {}) {
  const params = new URLSearchParams();
  if (view !== "overview") params.set("view", view);
  const projectId = extra.project ?? link.projectId;
  if (projectId && view !== "messages") params.set("project", projectId);
  if (extra.month) params.set("month", extra.month);
  const query = params.toString();
  return `/portal/${link.token}${query ? `?${query}` : ""}`;
}
