-- =============================================================================
-- Links portal: one private, no-login link per workspace to every client's
-- Frame.io and Drive links (/links/<token>). Like a client portal, the link
-- is the key; the app reads it with the service role, scoped to the
-- workspace the token belongs to.
-- =============================================================================

create table public.link_portals (
  workspace_id    uuid primary key default public.current_workspace_id()
                    references public.workspaces (id) on delete cascade,
  token           text not null unique check (token ~ '^[A-Za-z0-9_-]{32,64}$'),
  enabled         boolean not null default true,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  last_viewed_at  timestamptz
);

alter table public.link_portals enable row level security;

create policy "current workspace only" on public.link_portals
  as restrictive for all to authenticated
  using (workspace_id = (select public.current_workspace_id()))
  with check (workspace_id = (select public.current_workspace_id()));

create policy "full access only" on public.link_portals
  as restrictive for all to authenticated
  using ((select public.is_full_member()))
  with check ((select public.is_full_member()));

-- Managed with the clients, like client portals.
create policy "admin full access" on public.link_portals
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "delegated: manage clients" on public.link_portals
  for all to authenticated
  using ((select public.has_permission('clients.manage')))
  with check ((select public.has_permission('clients.manage')));
