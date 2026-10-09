/** Where the portal's views live. `project` narrows to one project (not on Messages). */
export type PortalLink = { token: string; projectId: string | null };

export function portalHref(link: PortalLink, view: string) {
  const params = new URLSearchParams();
  if (view !== "videos") params.set("view", view);
  if (link.projectId && view !== "messages") params.set("project", link.projectId);
  const query = params.toString();
  return `/portal/${link.token}${query ? `?${query}` : ""}`;
}
