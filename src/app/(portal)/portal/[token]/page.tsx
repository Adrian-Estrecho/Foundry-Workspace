import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { MessageSquareIcon } from "lucide-react";
import { AccentStyle } from "@/components/theme/accent-style";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PORTAL_TABS, PORTAL_VIEWS, type PortalView } from "@/features/portal/constants";
import { PortalMessages } from "@/features/portal/components/portal-messages";
import { PortalRefresh } from "@/features/portal/components/portal-refresh";
import { PortalBoard, PortalCalendar, PortalList, PortalOverview } from "@/features/portal/components/portal-views";
import { ProjectFilter } from "@/features/portal/components/project-filter";
import { portalHref, type PortalLink } from "@/features/portal/links";
import { getPortal } from "@/features/portal/queries";
import { WorkspaceTile } from "@/features/workspaces/components/workspace-switcher";
import { cn } from "@/lib/utils";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// The link is a key: keep it out of search engines and other sites' referrer logs.
export async function generateMetadata(props: PageProps<"/portal/[token]">): Promise<Metadata> {
  const portal = await getPortal((await props.params).token);
  return {
    title: portal ? `${portal.client.name} · ${portal.workspace.name}` : "Project portal",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

/**
 * A client's view of the work they've given the studio: an overview, the
 * tasks as a board, a list or a calendar (optionally for one project), and
 * a private conversation with the team.
 */
export default async function PortalPage(props: PageProps<"/portal/[token]">) {
  await connection();
  const { token } = await props.params;
  const search = await props.searchParams;
  const portal = await getPortal(token);

  if (!portal) {
    return (
      <section className="mx-auto mt-16 max-w-lg rounded-xl border bg-card p-10 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">This link doesn&apos;t work any more</h1>
        <p className="mt-3 text-muted-foreground">
          The studio may have replaced it with a new one. Ask them for the latest link to your project portal.
        </p>
      </section>
    );
  }

  const requestedView = first(search.view);
  const view: PortalView = PORTAL_VIEWS.includes(requestedView as PortalView) ? (requestedView as PortalView) : "overview";
  const requestedProject = first(search.project);
  const project = portal.projects.find((p) => p.id === requestedProject) ?? null;
  const requestedMonth = first(search.month);
  const month = requestedMonth && MONTH.test(requestedMonth) ? requestedMonth : portal.today.slice(0, 7);

  const tasks = project ? portal.tasks.filter((t) => t.projectId === project.id) : portal.tasks;
  const projects = project ? [project] : portal.projects;

  const link: PortalLink = { token, projectId: project?.id ?? null };

  return (
    <>
      <AccentStyle accent={portal.workspace.accent} />
      <PortalRefresh token={token} onMessages={view === "messages"} />

      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <WorkspaceTile name={portal.workspace.name} logoUrl={portal.workspace.logoUrl} className="size-9 text-base" />
          <span className="font-heading text-lg font-semibold tracking-tight">{portal.workspace.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">Project portal · {portal.client.name}</span>
          <ModeToggle />
        </div>
      </header>

      <div className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
          {project ? project.name : `Hi ${portal.client.contactName.split(" ")[0] || "there"}, here's where your work stands`}
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Every task {portal.workspace.name} is working on for {portal.client.name}, updated live as the team moves it along.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <nav aria-label="Portal views" className="inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-0.5 scrollbar-none">
          {PORTAL_TABS.map((item) => {
            const active = item.value === view;
            return (
              <Link
                key={item.value}
                href={portalHref(link, item.value)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center rounded-md px-3 py-1 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {view !== "messages" && portal.projects.length > 1 && (
            <ProjectFilter projects={portal.projects.map((p) => ({ id: p.id, name: p.name }))} value={project?.id ?? null} />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={portalHref(link, "messages")}
                scroll={false}
                aria-current={view === "messages" ? "page" : undefined}
                aria-label={portal.unread > 0 ? `Messages, ${portal.unread} new` : "Messages"}
                className="relative rounded-lg bg-muted p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-md transition-colors",
                    view === "messages" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <MessageSquareIcon className="size-4" />
                </span>
                {portal.unread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground ring-2 ring-background tabular">
                    {portal.unread > 99 ? "99+" : portal.unread}
                  </span>
                )}
              </Link>
            </TooltipTrigger>
            <TooltipContent>Messages</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {view === "overview" && (
        <PortalOverview
          projects={projects}
          tasks={tasks}
          today={portal.today}
          renderedAt={portal.renderedAt}
          link={link}
          unread={portal.unread}
        />
      )}
      {view === "board" && <PortalBoard tasks={tasks} today={portal.today} showProject={!project && portal.projects.length > 1} link={link} />}
      {view === "list" && <PortalList tasks={tasks} today={portal.today} showProject={!project && portal.projects.length > 1} />}
      {view === "calendar" && <PortalCalendar tasks={tasks} today={portal.today} month={month} link={link} />}
      {view === "messages" && (
        <PortalMessages
          token={token}
          workspaceName={portal.workspace.name}
          contactName={portal.client.contactName}
          messages={portal.messages}
          lastReadAt={portal.lastReadAt}
          renderedAt={portal.renderedAt}
        />
      )}
    </>
  );
}
