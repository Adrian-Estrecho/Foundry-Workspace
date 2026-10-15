"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRightIcon, CopyIcon, FolderOpenIcon, Link2Icon, PlayCircleIcon, SearchIcon, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { Segmented } from "@/components/shared/segmented";
import { StatusFilter } from "@/components/shared/status-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CLIENT_STAGES, stageLabel } from "../constants";
import { LINK_KINDS, shortUrl, type LinkKind } from "../links";
import type { ClientLink, LinkDirectoryClient } from "../queries";

type KindFilter = "all" | LinkKind;

const SECTIONS: { kind: LinkKind; label: string; icon: LucideIcon }[] = [
  { kind: "drive", label: "Drive", icon: FolderOpenIcon },
  { kind: "frameio", label: "Frame.io", icon: PlayCircleIcon },
];

/** Links a section shows before "Show all". */
const PREVIEW = 5;

/**
 * Each client's main Drive folder and their projects' Frame.io links, to
 * open or copy. `shared` is the links portal (no login): no stages and no
 * ways into ReEdit.
 */
export function ClientLinks({ clients, shared = false }: { clients: LinkDirectoryClient[]; shared?: boolean }) {
  const [query, setQuery] = React.useState("");
  const [stages, setStages] = React.useState<string[]>([]);
  const [kind, setKind] = React.useState<KindFilter>("all");
  const q = query.trim().toLowerCase();

  const inStages = React.useMemo(
    () => (stages.length ? clients.filter((c) => c.stage && stages.includes(c.stage)) : clients),
    [clients, stages],
  );
  const shown = React.useMemo(() => {
    const filtering = q !== "" || kind !== "all";
    return inStages
      .flatMap((client) => {
        const nameMatches = q !== "" && client.name.toLowerCase().includes(q);
        const links = client.links.filter(
          (link) =>
            (kind === "all" || link.kind === kind) &&
            (!q || nameMatches || [link.title, link.url].some((value) => value.toLowerCase().includes(q))),
        );
        // While filtering, a client with nothing to show drops out, unless it's the one searched for.
        if (filtering && links.length === 0 && !nameMatches) return [];
        return [{ ...client, links }];
      })
      .sort((a, b) => Number(a.links.length === 0) - Number(b.links.length === 0));
  }, [inStages, q, kind]);

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={Link2Icon}
        title={shared ? "No links yet" : "No clients yet"}
        description={shared ? "Each client's main folder and Frame.io link will show up here." : "Each client's main folder and Frame.io link show up here."}
        className="rounded-xl border bg-card"
      />
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clients, projects, links"
            aria-label="Search links"
            className="rounded-full bg-surface pl-9"
          />
        </div>
        {!shared && (
          <StatusFilter
            noun="stages"
            value={stages}
            onChange={setStages}
            options={CLIENT_STAGES.map((stage) => ({
              id: stage.value,
              label: stage.label,
              dot: stage.dot,
              count: clients.filter((c) => c.stage === stage.value).length,
            }))}
            className="bg-surface"
          />
        )}
        <Segmented
          label="Link type"
          value={kind}
          onChange={setKind}
          options={[{ value: "all", label: "All" }, ...LINK_KINDS]}
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={SearchIcon} title="No links match" description="Try another search or filter." className="rounded-xl border bg-card" />
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          {shown.map((client) => (
            <ClientLinksCard key={client.id} client={client} kind={kind} expanded={q !== ""} shared={shared} />
          ))}
        </div>
      )}
    </>
  );
}

function ClientLinksCard({
  client,
  kind,
  expanded,
  shared,
}: {
  client: LinkDirectoryClient;
  kind: KindFilter;
  expanded: boolean;
  shared: boolean;
}) {
  const stage = CLIENT_STAGES.find((s) => s.value === client.stage);
  return (
    <section aria-labelledby={`links-${client.id}`} className="flex flex-col rounded-xl border bg-card p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`links-${client.id}`} className="truncate font-heading text-base font-medium">
            {client.name}
          </h2>
          {client.stage && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", stage?.dot)} />
              {stageLabel(client.stage)}
            </p>
          )}
        </div>
        {!shared && (
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href={`/clients/${client.id}`}>
              Open client <ArrowRightIcon />
            </Link>
          </Button>
        )}
      </header>
      <div className="grid grid-cols-1 gap-4">
        {SECTIONS.filter((section) => kind === "all" || section.kind === kind).map((section) => (
          <LinkSection
            key={section.kind}
            section={section}
            links={client.links.filter((link) => link.kind === section.kind)}
            addHref={shared ? null : `/clients/${client.id}`}
            expanded={expanded}
            shared={shared}
          />
        ))}
      </div>
    </section>
  );
}

function LinkSection({
  section,
  links,
  addHref,
  expanded,
  shared,
}: {
  section: (typeof SECTIONS)[number];
  links: ClientLink[];
  /** The client's page, where a missing link is added (folder there, Frame.io on a project). */
  addHref: string | null;
  /** Show every link (while searching). */
  expanded: boolean;
  shared: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const all = expanded || open;
  const visible = all ? links : links.slice(0, PREVIEW);

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <section.icon className="size-3.5" aria-hidden="true" />
        {section.label}
        <span className="tabular">{links.length}</span>
      </h3>
      {links.length === 0 ? (
        <p className="rounded-lg border border-dashed p-2.5 text-sm text-muted-foreground">
          {section.kind === "drive" ? "No main folder yet." : "No Frame.io link yet."}
          {addHref && (
            <>
              {" "}
              <Link href={addHref} className="text-foreground hover:text-primary hover:underline">
                {section.kind === "drive" ? "Add one" : "Add one on a project"}
              </Link>
            </>
          )}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5">
          {visible.map((link) => (
            <LinkRow key={link.url} link={link} icon={section.icon} shared={shared} />
          ))}
        </ul>
      )}
      {!expanded && links.length > PREVIEW && (
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} className="mt-1.5 text-muted-foreground">
          {open ? "Show fewer" : `Show all ${links.length}`}
        </Button>
      )}
    </div>
  );
}

function LinkRow({ link, icon: Icon, shared }: { link: ClientLink; icon: LucideIcon; shared: boolean }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  return (
    <li className="flex items-center gap-0.5 rounded-lg bg-surface pr-1.5 ring-1 ring-border transition-colors hover:bg-accent/50">
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        title={link.url}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{link.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{shortUrl(link.url)}</span>
        </span>
      </a>
      <Button variant="ghost" size="icon-sm" onClick={copy} aria-label={`Copy link: ${link.title}`} title="Copy link">
        <CopyIcon />
      </Button>
      {link.href ? (
        <Button asChild variant="ghost" size="icon-sm" title="Open the project">
          <Link href={link.href} aria-label={`Open project: ${link.title}`}>
            <ArrowRightIcon />
          </Link>
        </Button>
      ) : (
        // Keeps the copy buttons in line.
        !shared && <span aria-hidden="true" className="size-7 shrink-0" />
      )}
    </li>
  );
}
