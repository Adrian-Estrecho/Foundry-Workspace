import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLinkIcon, HistoryIcon, InboxIcon, UsersIcon } from "lucide-react";
import { EmptyState, Panel } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ChecklistPanel } from "@/features/clients/components/detail/checklist-panel";
import { ClientHeader } from "@/features/clients/components/detail/client-header";
import { ContactPanel } from "@/features/clients/components/detail/contact-panel";
import { FilesPanel } from "@/features/clients/components/detail/files-panel";
import { NotesPanel } from "@/features/clients/components/detail/notes-panel";
import { PaymentsPanel } from "@/features/clients/components/detail/payments-panel";
import { ProjectsPanel } from "@/features/clients/components/detail/projects-panel";
import { getClientDetail } from "@/features/clients/queries";
import { ClientPortalPanel } from "@/features/portal/components/portal-admin";
import { requireAdmin } from "@/lib/auth";
import { formatDay, timeAgo, todayIn } from "@/lib/dates";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(props: PageProps<"/clients/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!UUID.test(id)) return { title: "Client" };
  const { client } = await getClientDetail(id);
  return { title: client.name };
}

export default async function ClientPage(props: PageProps<"/clients/[id]">) {
  const user = await requireAdmin();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();

  const [{ client, checklist, projects, assignedEditors, activity, contractUrl, editors, renderedAt }, { data: portal }] = await Promise.all([
    getClientDetail(id),
    (await createClient()).from("client_portals").select("token, enabled, last_viewed_at").eq("client_id", id).maybeSingle(),
  ]);
  const today = todayIn(user.timezone);
  const lead = client.lead;

  return (
    <>
      <RealtimeRefresh channel={`client-${id}`} tables="clients,client_checklist_items,projects,project_editors,message_threads" />
      <ClientHeader
        client={{
          id: client.id,
          name: client.name,
          contactName: client.contact_name,
          email: client.email,
          stage: client.stage,
          driveFolderUrl: client.drive_folder_url,
          deadline: client.deadline,
        }}
        projectCount={projects.length}
        editors={editors}
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="grid content-start gap-5 xl:col-span-8">
          <ChecklistPanel items={checklist} renderedAt={renderedAt} />
          <ProjectsPanel
            client={{ id: client.id, name: client.name, driveFolderUrl: client.drive_folder_url, deadline: client.deadline }}
            projects={projects.map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
              deadline: p.deadline,
              editors: p.project_editors
                .map(({ editor }) => editor && { id: editor.id, name: editor.profile?.full_name ?? "Editor", avatarUrl: editor.profile?.avatar_url ?? null })
                .filter((e): e is NonNullable<typeof e> => Boolean(e)),
            }))}
            editors={editors}
            today={today}
          />
          <NotesPanel clientId={client.id} notes={client.call_notes} />

          {lead && (
            <Panel
              title="Original enquiry"
              description={`Sent through the intake form ${timeAgo(lead.created_at, renderedAt)}`}
              action={<InboxIcon className="size-5 text-status-online" />}
            >
              <dl className="grid gap-4 sm:grid-cols-3">
                <Fact label="Project type" value={lead.project_type} />
                <Fact label="Budget" value={lead.budget_range} />
                <Fact label="Deadline" value={lead.deadline && formatDay(lead.deadline, { month: "short", day: "numeric", year: "numeric" })} />
              </dl>
              {lead.reference_links.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs text-muted-foreground">References</p>
                  <ul className="mt-2 grid gap-1.5">
                    {lead.reference_links.map((link) => (
                      <li key={link}>
                        <a href={link} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-sm hover:text-primary">
                          <ExternalLinkIcon className="size-3.5 shrink-0" />
                          <span className="truncate">{link}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {lead.notes && (
                <div className="mt-5">
                  <p className="text-xs text-muted-foreground">Their notes</p>
                  <p className="mt-1.5 rounded-2xl bg-surface p-3 text-sm whitespace-pre-line ring-1 ring-border">{lead.notes}</p>
                </div>
              )}
            </Panel>
          )}
        </div>

        <div className="grid content-start gap-5 xl:col-span-4">
          <ClientPortalPanel
            clientId={client.id}
            clientName={client.name}
            portal={portal ? { token: portal.token, enabled: portal.enabled, lastViewedAt: portal.last_viewed_at } : null}
            siteUrl={env.siteUrl}
            renderedAt={renderedAt}
          />
          <ContactPanel
            clientId={client.id}
            contact={{
              contact_name: client.contact_name,
              company: client.company,
              email: client.email,
              phone: client.phone,
              project_type: client.project_type,
              budget_range: client.budget_range,
              deadline: client.deadline,
            }}
          />
          <PaymentsPanel clientId={client.id} deposit={client.deposit_status} final={client.final_status} />
          <FilesPanel
            clientId={client.id}
            contractPath={client.contract_path}
            contractUrl={contractUrl}
            driveFolderUrl={client.drive_folder_url}
          />

          <Panel title="Assigned editors">
            {assignedEditors.length === 0 ? (
              <EmptyState icon={UsersIcon} title="No editors yet" description="Editors appear here when they join one of this client's projects." />
            ) : (
              <ul className="grid gap-2">
                {assignedEditors.map((editor) => (
                  <li key={editor.id} className="flex items-center gap-3 rounded-2xl bg-surface p-2.5 ring-1 ring-border">
                    <UserAvatar name={editor.name} src={editor.avatarUrl} className="size-9" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{editor.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{editor.projects.join(", ")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="History">
            {activity.length === 0 ? (
              <EmptyState icon={HistoryIcon} title="Nothing yet" />
            ) : (
              <ol className="grid gap-3">
                {activity.map((item) => (
                  <li key={item.id} className="flex items-start gap-3">
                    {item.actor ? (
                      <UserAvatar name={item.actor.full_name} src={item.actor.avatar_url} className="size-7" />
                    ) : (
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-strong ring-1 ring-border">
                        <InboxIcon className="size-3.5 text-primary" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm leading-snug">{item.summary}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(item.created_at, renderedAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}
