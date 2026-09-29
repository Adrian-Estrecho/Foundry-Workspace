-- =============================================================================
-- Foundry · 0009 · Workspaces (Phase 4.5): access control
--   * Every tenant table gets one RESTRICTIVE policy: rows from the current
--     workspace only. Restrictive policies are ANDed with the permissive ones
--     from 0003, which keep deciding what each role may do inside it.
--   * Profiles: you see yourself and the people you work with. A candidate
--     still onboarding sees only the workspace's admins. Nobody edits
--     someone else's profile (it is shared across their workspaces).
--   * Workspaces and memberships are readable by their members.
--   * Storage and Realtime presence are scoped to the workspace too.
--   * app_settings and profiles.role are gone.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tenant isolation
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'leads', 'clients', 'client_checklist_items', 'applicants', 'editors', 'editor_documents',
    'editor_payment_details', 'editor_checklist_items', 'projects', 'project_editors', 'tasks',
    'subtasks', 'task_attachments', 'task_comments', 'shifts', 'time_logs', 'status_events',
    'shift_reports', 'meetings', 'meeting_rsvps', 'announcements', 'announcement_comments',
    'announcement_reactions', 'ideas', 'sops', 'sop_acknowledgments', 'notifications', 'activity_log'
  ] loop
    execute format(
      'create policy "current workspace only" on public.%I
         as restrictive for all to authenticated
         using (workspace_id = (select public.current_workspace_id()))
         with check (workspace_id = (select public.current_workspace_id()))', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Workspaces & memberships
-- -----------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- True when the caller belongs (onboarding or active) to the workspace.
create or replace function public.is_member_of(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = (select auth.uid())
      and status in ('onboarding', 'active')
  );
$$;

create policy "members read their workspaces" on public.workspaces
  for select to authenticated using (public.is_member_of(id));

create policy "admins update their workspace" on public.workspaces
  for update to authenticated
  using (id = (select public.current_workspace_id()) and (select public.is_admin()))
  with check (id = (select public.current_workspace_id()) and (select public.is_admin()));

-- Your own memberships in every workspace (the switcher), and the people in
-- the current one (a candidate still onboarding sees only its admins).
-- Memberships are created through functions.
create policy "users read own memberships" on public.workspace_members
  for select to authenticated using (user_id = (select auth.uid()));

create policy "members read the current workspace's members" on public.workspace_members
  for select to authenticated
  using (workspace_id = (select public.current_workspace_id())
         and ((select public.is_full_member()) or (role in ('owner', 'admin') and status = 'active')));

-- Admins change roles and access in their workspace. The owner stays owner
-- and active, and nobody changes their own membership here.
create policy "admins manage members" on public.workspace_members
  for update to authenticated
  using (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()))
  with check (workspace_id = (select public.current_workspace_id()) and (select public.is_admin()));

create or replace function public.guard_member_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.workspace_id <> old.workspace_id or new.user_id <> old.user_id then
    raise exception 'Memberships can''t move.' using errcode = '42501';
  end if;
  if (new.role, new.status) is distinct from (old.role, old.status) then
    if new.user_id = (select auth.uid()) then
      raise exception 'You can''t change your own role or access.' using errcode = '42501';
    end if;
    if old.role = 'owner' or new.role = 'owner' then
      raise exception 'The workspace owner can''t be changed here.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_member_changes
  before update on public.workspace_members
  for each row execute function public.guard_member_changes();

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
drop policy "admin full access" on public.profiles;
drop policy "signed-in users read profiles" on public.profiles;

-- Whose profile the caller can see: their own; for a full member, everyone
-- who has been in the workspace (so names in history still resolve); for a
-- candidate still onboarding, only the workspace's admins.
create or replace function public.can_see_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = (select public.current_workspace_id())
        and m.user_id = p_user_id
        and ((select public.is_full_member()) or (m.role in ('owner', 'admin') and m.status = 'active'))
    );
$$;

create policy "users read profiles they work with" on public.profiles
  for select to authenticated using (public.can_see_profile(id));

-- ("users update own profile" from 0003 stays; guard_profile_changes limits it.)

-- -----------------------------------------------------------------------------
-- The client directory runs as its owner, so it filters by workspace itself.
-- -----------------------------------------------------------------------------
create or replace view public.client_directory
with (security_invoker = false) as
  select c.id, c.company, c.contact_name
  from public.clients c
  where c.workspace_id = (select public.current_workspace_id())
    and (
      (select public.is_admin())
      or exists (
        select 1 from public.projects p
        where p.client_id = c.id and public.is_project_member(p.id)
      )
    );

-- -----------------------------------------------------------------------------
-- Storage
--   contracts    <client_id>/…               admins of the client's workspace
--   task-files   <task_id>/…                 admins and the assignee, in the task's workspace
--   editor-docs  <workspace_id>/<editor_id>/… admins of that workspace and the editor
-- The subqueries on clients and tasks run under the caller's RLS, so they
-- only find rows in the caller's current workspace.
-- -----------------------------------------------------------------------------
drop policy "admins manage private files" on storage.objects;
drop policy "editors read own documents" on storage.objects;
drop policy "editors upload own documents" on storage.objects;
drop policy "editors delete own documents" on storage.objects;
drop policy "assignees read task files" on storage.objects;
drop policy "assignees upload task files" on storage.objects;
drop policy "assignees delete own task files" on storage.objects;

create policy "admins manage client contracts" on storage.objects
  for all to authenticated
  using (bucket_id = 'contracts' and (select public.is_admin())
         and exists (select 1 from public.clients c where c.id = public.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'contracts' and (select public.is_admin())
              and exists (select 1 from public.clients c where c.id = public.try_uuid((storage.foldername(name))[1])));

create policy "admins manage task files" on storage.objects
  for all to authenticated
  using (bucket_id = 'task-files' and (select public.is_admin())
         and exists (select 1 from public.tasks t where t.id = public.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'task-files' and (select public.is_admin())
              and exists (select 1 from public.tasks t where t.id = public.try_uuid((storage.foldername(name))[1])));

create policy "assignees read task files" on storage.objects
  for select to authenticated
  using (bucket_id = 'task-files'
         and public.is_task_assignee(public.try_uuid((storage.foldername(name))[1])));
create policy "assignees upload task files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-files'
              and public.is_task_assignee(public.try_uuid((storage.foldername(name))[1])));
create policy "assignees delete own task files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'task-files'
         and owner_id = (select auth.uid())::text
         and public.is_task_assignee(public.try_uuid((storage.foldername(name))[1])));

create policy "admins manage editor documents" on storage.objects
  for all to authenticated
  using (bucket_id = 'editor-docs' and (select public.is_admin())
         and (storage.foldername(name))[1] = (select public.current_workspace_id())::text)
  with check (bucket_id = 'editor-docs' and (select public.is_admin())
              and (storage.foldername(name))[1] = (select public.current_workspace_id())::text);

create policy "editors read own documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'editor-docs'
         and (storage.foldername(name))[1] = (select public.current_workspace_id())::text
         and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy "editors upload own documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'editor-docs'
              and (storage.foldername(name))[1] = (select public.current_workspace_id())::text
              and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy "editors delete own documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'editor-docs'
         and (storage.foldername(name))[1] = (select public.current_workspace_id())::text
         and (storage.foldername(name))[2] = (select auth.uid())::text);

-- -----------------------------------------------------------------------------
-- Realtime presence: one private channel per workspace, "presence:<id>",
-- for its full members (candidates don't see the live team).
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "team presence: listen" on realtime.messages';
    execute 'drop policy if exists "team presence: track" on realtime.messages';
    execute $p$
      create policy "workspace presence: listen" on realtime.messages
        for select to authenticated
        using ((select realtime.topic()) = 'presence:' || (select public.current_workspace_id())::text
               and (select public.is_full_member()))
    $p$;
    execute $p$
      create policy "workspace presence: track" on realtime.messages
        for insert to authenticated
        with check ((select realtime.topic()) = 'presence:' || (select public.current_workspace_id())::text
                    and (select public.is_full_member()))
    $p$;
  else
    raise warning 'realtime.messages not found: presence policies not created';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- The single-company pieces are gone: settings live on workspaces, roles on
-- memberships, and "announcements seen" is per workspace.
-- -----------------------------------------------------------------------------
drop table public.app_settings;
alter table public.profiles drop column role;
alter table public.profiles drop column announcements_seen_at;
drop type public.user_role;
