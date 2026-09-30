-- =============================================================================
-- People and access
--
-- Owners and admins can hand single admin abilities to an editor, and give
-- anyone an access title ("Operational control"), from the People page.
--
--   workspace_members.title        shown next to the name; null = the role
--   workspace_members.permissions  the abilities an editor was given
--
-- has_permission(key) is true for active owners and admins, and for active
-- editors who were given that ability. People still onboarding never pass.
--
-- The existing "admin full access" policies stay. Each ability adds its own
-- permissive policy ("delegated: …") next to them, and the functions that
-- checked is_admin() for one area now check that area's ability instead,
-- which admins still pass.
--
-- Keep the keys in step with src/lib/permissions.ts.
-- =============================================================================

alter table public.workspace_members
  add column title text
    constraint workspace_members_title_length check (title is null or char_length(btrim(title)) between 1 and 40),
  add column permissions text[] not null default '{}'
    constraint workspace_members_permissions_known check (permissions <@ array[
      'tasks.status', 'tasks.manage', 'statuses.manage',
      'editors.manage', 'clients.manage', 'attendance.view',
      'workspace.brand', 'workspace.forms', 'workspace.contract', 'workspace.links',
      'announcements.post', 'sops.manage'
    ]::text[]);

-- The caller, active in their current workspace, holds this ability.
create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.workspace_members m on m.workspace_id = p.active_workspace_id and m.user_id = p.id
    where p.id = (select auth.uid())
      and m.status = 'active'
      and (m.role in ('owner', 'admin') or p_permission = any (m.permissions))
  );
$$;

-- Test edits belong to hiring; every other task to task management.
create or replace function public.can_manage_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and t.workspace_id = (select public.current_workspace_id())
      and case when t.is_trial then public.has_permission('editors.manage')
               else public.has_permission('tasks.manage') end
  );
$$;

-- -----------------------------------------------------------------------------
-- Changing access
-- -----------------------------------------------------------------------------
create or replace function public.guard_member_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or current_setting('foundry.membership_change', true) = 'on' then
    return new;
  end if;
  if new.workspace_id <> old.workspace_id or new.user_id <> old.user_id then
    raise exception 'Memberships can''t move.' using errcode = '42501';
  end if;
  if (new.role, new.status, new.permissions) is distinct from (old.role, old.status, old.permissions) then
    if new.user_id = (select auth.uid()) then
      raise exception 'You can''t change your own role or access.' using errcode = '42501';
    end if;
    if old.role = 'owner' or new.role = 'owner' then
      raise exception 'The workspace owner can''t be changed here.' using errcode = '42501';
    end if;
  end if;
  if new.title is distinct from old.title and old.role = 'owner' and new.user_id <> (select auth.uid()) then
    raise exception 'Only the owner can change their own title.' using errcode = '42501';
  end if;
  if new.role = 'admin' and new.status <> 'active' then
    raise exception 'Only approved members can be admins.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- An admin who becomes an editor gets an editor record, so they can be
-- given work and clock in.
create or replace function public.ensure_editor_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'editor' and old.role <> 'editor' then
    insert into public.editors (workspace_id, id, onboarding_completed_at)
    values (new.workspace_id, new.user_id, now())
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger ensure_editor_record
  after update of role on public.workspace_members
  for each row execute function public.ensure_editor_record();

-- -----------------------------------------------------------------------------
-- Pay rates: only people who manage editors read hourly_rate. Row policies
-- can't hide one column, so it leaves the SELECT grant and editor_rates()
-- serves it. A column added to editors later needs its own grant here.
-- -----------------------------------------------------------------------------
revoke select on public.editors from anon, authenticated;
grant select (
  id, workspace_id, applicant_id, software, specialties, weekly_hours, work_days, shift_start, is_active,
  onboarding_completed_at, work_status, current_task_id, current_shift_id, status_since, created_at, updated_at
) on public.editors to authenticated;

create or replace function public.editor_rates()
returns table (editor_id uuid, hourly_rate numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.hourly_rate
  from public.editors e
  where e.workspace_id = (select public.current_workspace_id())
    and (select public.has_permission('editors.manage'));
$$;

-- -----------------------------------------------------------------------------
-- Work: tasks.manage, tasks.status, statuses.manage
-- -----------------------------------------------------------------------------
create policy "delegated: manage tasks" on public.tasks
  for all to authenticated
  using (case when is_trial then (select public.has_permission('editors.manage'))
              else (select public.has_permission('tasks.manage')) end)
  with check (case when is_trial then (select public.has_permission('editors.manage'))
                   else (select public.has_permission('tasks.manage')) end);

create policy "delegated: manage subtasks" on public.subtasks
  for all to authenticated
  using (public.can_manage_task(task_id))
  with check (public.can_manage_task(task_id));

create policy "delegated: read attachments" on public.task_attachments
  for select to authenticated using (public.can_manage_task(task_id));
create policy "delegated: add attachments" on public.task_attachments
  for insert to authenticated
  with check (public.can_manage_task(task_id) and added_by = (select auth.uid()));
create policy "delegated: remove attachments" on public.task_attachments
  for delete to authenticated using (public.can_manage_task(task_id));

create policy "delegated: read comments" on public.task_comments
  for select to authenticated using (public.can_manage_task(task_id));
create policy "delegated: comment" on public.task_comments
  for insert to authenticated
  with check (public.can_manage_task(task_id) and author_id = (select auth.uid()));

create policy "delegated: manage task files" on storage.objects
  for all to authenticated
  using (bucket_id = 'task-files' and public.can_manage_task(public.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'task-files' and public.can_manage_task(public.try_uuid((storage.foldername(name))[1])));

create policy "delegated: manage projects" on public.projects
  for all to authenticated
  using ((select public.has_permission('tasks.manage')))
  with check ((select public.has_permission('tasks.manage')));
create policy "delegated: read client projects" on public.projects
  for select to authenticated using ((select public.has_permission('clients.manage')));

create policy "delegated: manage project teams" on public.project_editors
  for all to authenticated
  using ((select public.has_permission('tasks.manage')))
  with check ((select public.has_permission('tasks.manage')));
create policy "delegated: read client project teams" on public.project_editors
  for select to authenticated using ((select public.has_permission('clients.manage')));

-- Which projects follow a ClickUp List (their tasks are locked to it).
create policy "delegated: read clickup links" on public.clickup_pipelines
  for select to authenticated using ((select public.has_permission('tasks.manage')));

create policy "delegated: add statuses" on public.task_statuses
  for insert to authenticated with check ((select public.has_permission('statuses.manage')));
create policy "delegated: edit statuses" on public.task_statuses
  for update to authenticated
  using ((select public.has_permission('statuses.manage')))
  with check ((select public.has_permission('statuses.manage')));
create policy "delegated: add statuses" on public.project_statuses
  for insert to authenticated with check ((select public.has_permission('statuses.manage')));
create policy "delegated: edit statuses" on public.project_statuses
  for update to authenticated
  using ((select public.has_permission('statuses.manage')))
  with check ((select public.has_permission('statuses.manage')));

-- Editors change the status and progress of their own tasks, up to For
-- Review. Everything else needs tasks.manage (test edits: editors.manage);
-- Done, Revisions and reopening need tasks.status.
create or replace function public.guard_task_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_workspace uuid := new.workspace_id;
  v_stage public.task_status;
  v_name text;
  v_manage boolean;
  v_any_status boolean;
begin
  if tg_op = 'INSERT' and new.project_id is not null then
    v_workspace := coalesce((select p.workspace_id from public.projects p where p.id = new.project_id), v_workspace);
  end if;

  if new.status_id is not null and (tg_op = 'INSERT' or new.status_id is distinct from old.status_id) then
    select s.stage into v_stage
    from public.task_statuses s
    where s.id = new.status_id and s.workspace_id = v_workspace;
    if v_stage is null then
      raise exception 'That status no longer exists. Refresh and try again.' using errcode = '23503';
    end if;
    new.status := v_stage;
  elsif new.status_id is null or new.status is distinct from old.status then
    new.status_id := (
      select s.id from public.task_statuses s
      where s.workspace_id = v_workspace and s.stage = new.status
      order by s.position, s.created_at
      limit 1
    );
  end if;

  if tg_op = 'UPDATE' and (select auth.uid()) is not null then
    if old.is_trial then
      v_manage := public.has_permission('editors.manage');
      v_any_status := v_manage;
    else
      v_manage := public.has_permission('tasks.manage');
      v_any_status := public.has_permission('tasks.status');
    end if;

    if not v_manage and (
       new.project_id     is distinct from old.project_id
    or new.assignee_id    is distinct from old.assignee_id
    or new.title          is distinct from old.title
    or new.description    is distinct from old.description
    or new.due_date       is distinct from old.due_date
    or new.priority       is distinct from old.priority
    or new.revision_count is distinct from old.revision_count
    or new.is_trial       is distinct from old.is_trial
    or new.idea_id        is distinct from old.idea_id
    or new.created_by     is distinct from old.created_by) then
      raise exception 'Editors can only change the status and progress of their tasks.'
        using errcode = '42501';
    end if;

    if not v_any_status and new.status_id is distinct from old.status_id then
      if old.status = 'done' then
        raise exception 'This task is done. Ask an admin to reopen it.' using errcode = '42501';
      end if;
      if new.status in ('done', 'revisions') then
        select s.name into v_name from public.task_statuses s where s.id = new.status_id;
        raise exception 'Only an admin can move a task to %.', coalesce(v_name, public.task_status_label(new.status))
          using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'revisions' and old.status <> 'revisions' then
      new.revision_count := old.revision_count + 1;
    end if;
  end if;

  if new.status = 'done' then
    new.completed_at := coalesce(new.completed_at, now());
    new.progress_pct := 100;
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.delete_task_status(p_status_id uuid, p_move_to uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.task_statuses%rowtype;
begin
  if not (select public.has_permission('statuses.manage')) then
    raise exception 'You don''t have access to edit statuses.' using errcode = '42501';
  end if;
  select * into v_status from public.task_statuses
  where id = p_status_id and workspace_id = (select public.current_workspace_id());
  if not found then
    raise exception 'That status no longer exists. Refresh and try again.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.task_statuses
    where workspace_id = v_status.workspace_id and stage = v_status.stage and id <> v_status.id
  ) then
    raise exception 'Every stage needs at least one status, so % can''t be removed.', v_status.name using errcode = 'P0001';
  end if;

  if exists (select 1 from public.tasks where status_id = v_status.id) then
    if not exists (
      select 1 from public.task_statuses
      where id = p_move_to and workspace_id = v_status.workspace_id and stage = v_status.stage and id <> v_status.id
    ) then
      raise exception 'Pick where its tasks go.' using errcode = 'P0001';
    end if;
    perform set_config('reedit.removing_status', 'on', true);
    update public.tasks set status_id = p_move_to where status_id = v_status.id;
    perform set_config('reedit.removing_status', '', true);
  end if;

  delete from public.task_statuses where id = v_status.id;
end;
$$;

create or replace function public.delete_project_status(p_status_id uuid, p_move_to uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.project_statuses%rowtype;
begin
  if not (select public.has_permission('statuses.manage')) then
    raise exception 'You don''t have access to edit statuses.' using errcode = '42501';
  end if;
  select * into v_status from public.project_statuses
  where id = p_status_id and workspace_id = (select public.current_workspace_id());
  if not found then
    raise exception 'That status no longer exists. Refresh and try again.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.project_statuses
    where workspace_id = v_status.workspace_id and stage = v_status.stage and id <> v_status.id
  ) then
    raise exception 'Every stage needs at least one status, so % can''t be removed.', v_status.name using errcode = 'P0001';
  end if;

  if exists (select 1 from public.projects where status_id = v_status.id) then
    if not exists (
      select 1 from public.project_statuses
      where id = p_move_to and workspace_id = v_status.workspace_id and stage = v_status.stage and id <> v_status.id
    ) then
      raise exception 'Pick where its projects go.' using errcode = 'P0001';
    end if;
    perform set_config('reedit.removing_status', 'on', true);
    update public.projects set status_id = p_move_to where status_id = v_status.id;
    perform set_config('reedit.removing_status', '', true);
  end if;

  delete from public.project_statuses where id = v_status.id;
end;
$$;

create or replace function public.reorder_statuses(p_kind text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace uuid := (select public.current_workspace_id());
  v_table text;
  v_count int;
begin
  if not (select public.has_permission('statuses.manage')) then
    raise exception 'You don''t have access to edit statuses.' using errcode = '42501';
  end if;
  v_table := case p_kind when 'task' then 'task_statuses' when 'project' then 'project_statuses' end;
  if v_table is null then
    raise exception 'Unknown kind of status.' using errcode = '22023';
  end if;

  -- The list must be exactly the workspace's statuses, each once.
  execute format(
    'select count(*) from public.%I where workspace_id = $1', v_table
  ) into v_count using v_workspace;
  if cardinality(p_ids) <> v_count
     or (select count(distinct id) from unnest(p_ids) as id) <> v_count then
    raise exception 'The statuses changed meanwhile. Refresh and try again.' using errcode = 'P0001';
  end if;
  execute format(
    'select count(*) from public.%I where workspace_id = $1 and id = any ($2)', v_table
  ) into v_count using v_workspace, p_ids;
  if v_count <> cardinality(p_ids) then
    raise exception 'The statuses changed meanwhile. Refresh and try again.' using errcode = 'P0001';
  end if;

  execute format(
    'update public.%I s set position = o.n
       from unnest($1::uuid[]) with ordinality as o(id, n)
      where s.id = o.id and s.workspace_id = $2 and s.position is distinct from o.n', v_table
  ) using p_ids, v_workspace;
end;
$$;

-- -----------------------------------------------------------------------------
-- People: editors.manage (hiring and onboarding), clients.manage, attendance.view
-- -----------------------------------------------------------------------------
create policy "delegated: read editors" on public.editors
  for select to authenticated
  using ((select public.has_permission('editors.manage'))
         or (select public.has_permission('tasks.manage'))
         or (select public.has_permission('attendance.view'))
         or (select public.has_permission('clients.manage'))
         or (select public.has_permission('sops.manage')));
create policy "delegated: update editors" on public.editors
  for update to authenticated
  using ((select public.has_permission('editors.manage')))
  with check ((select public.has_permission('editors.manage')));

do $$
declare
  t text;
begin
  foreach t in array array[
    'applicants', 'editor_checklist_items', 'editor_documents', 'editor_interviews',
    'editor_notes', 'workspace_invitations', 'workspace_settings'
  ] loop
    execute format(
      'create policy "delegated: hire and onboard" on public.%I
         for all to authenticated
         using ((select public.has_permission(''editors.manage'')))
         with check ((select public.has_permission(''editors.manage'')))', t);
  end loop;

  foreach t in array array['leads', 'clients', 'client_checklist_items', 'client_portals'] loop
    execute format(
      'create policy "delegated: manage clients" on public.%I
         for all to authenticated
         using ((select public.has_permission(''clients.manage'')))
         with check ((select public.has_permission(''clients.manage'')))', t);
  end loop;

  -- The roster shows hours this week, so hiring reads time too.
  foreach t in array array['shifts', 'time_logs', 'status_events', 'shift_reports'] loop
    execute format(
      'create policy "delegated: read attendance" on public.%I
         for select to authenticated
         using ((select public.has_permission(''attendance.view''))
                or (select public.has_permission(''editors.manage'')))', t);
  end loop;
end;
$$;

create policy "delegated: manage editor documents" on storage.objects
  for all to authenticated
  using (bucket_id = 'editor-docs' and (select public.has_permission('editors.manage'))
         and (storage.foldername(name))[1] = (select public.current_workspace_id())::text)
  with check (bucket_id = 'editor-docs' and (select public.has_permission('editors.manage'))
              and (storage.foldername(name))[1] = (select public.current_workspace_id())::text);

create policy "delegated: manage client contracts" on storage.objects
  for all to authenticated
  using (bucket_id = 'contracts' and (select public.has_permission('clients.manage'))
         and exists (select 1 from public.clients c where c.id = public.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'contracts' and (select public.has_permission('clients.manage'))
              and exists (select 1 from public.clients c where c.id = public.try_uuid((storage.foldername(name))[1])));

-- History panels: each area reads its own entries.
create policy "delegated: read history" on public.activity_log
  for select to authenticated
  using (
    (entity_type in ('task', 'project') and (select public.has_permission('tasks.manage')))
    or (entity_type in ('editor', 'applicant') and (select public.has_permission('editors.manage')))
    or (entity_type = 'client' and (select public.has_permission('clients.manage')))
  );

create or replace view public.client_directory
with (security_invoker = false) as
  select c.id, c.company, c.contact_name
  from public.clients c
  where c.workspace_id = (select public.current_workspace_id())
    and (
      (select public.has_permission('tasks.manage'))
      or (select public.has_permission('clients.manage'))
      or exists (
        select 1 from public.projects p
        where p.client_id = c.id and public.is_project_member(p.id)
      )
    );

create or replace function public.approve_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (select public.current_workspace_id());
  v_workspace text;
  v_name text;
begin
  if not (select public.has_permission('editors.manage')) then
    raise exception 'Only an admin can approve editors.' using errcode = '42501';
  end if;
  perform set_config('foundry.membership_change', 'on', true);

  update public.workspace_members
     set status = 'active', approved_at = now(), approved_by = (select auth.uid())
   where workspace_id = v_workspace_id and user_id = p_user_id and role = 'editor' and status = 'onboarding';
  if not found then
    raise exception 'not_onboarding' using errcode = 'P0001';
  end if;

  update public.editors
     set onboarding_completed_at = coalesce(onboarding_completed_at, now()), is_active = true
   where workspace_id = v_workspace_id and id = p_user_id;

  select name into v_workspace from public.workspaces where id = v_workspace_id;
  select full_name into v_name from public.profiles where id = p_user_id;

  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
  values (v_workspace_id, (select auth.uid()), 'editor.approved', 'editor', p_user_id,
          v_name || ' was approved and joined the team');

  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  values (v_workspace_id, p_user_id, 'onboarding_approved', 'You''re in: welcome to ' || v_workspace,
          'Your full workspace is open', '/dashboard', 'editor', p_user_id);
end;
$$;

create or replace function public.reject_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (select public.current_workspace_id());
  v_name text;
begin
  if not (select public.has_permission('editors.manage')) then
    raise exception 'Only an admin can decide on editors.' using errcode = '42501';
  end if;
  perform set_config('foundry.membership_change', 'on', true);

  update public.workspace_members
     set status = 'rejected', approved_at = null, approved_by = null
   where workspace_id = v_workspace_id and user_id = p_user_id and role = 'editor' and status = 'onboarding';
  if not found then
    raise exception 'not_onboarding' using errcode = 'P0001';
  end if;

  update public.editors set is_active = false where workspace_id = v_workspace_id and id = p_user_id;
  update public.editor_interviews set outcome = 'cancelled'
   where workspace_id = v_workspace_id and editor_id = p_user_id and outcome = 'scheduled';
  update public.applicants a set stage = 'rejected'
    from public.editors e
   where e.workspace_id = v_workspace_id and e.id = p_user_id and a.id = e.applicant_id;

  select full_name into v_name from public.profiles where id = p_user_id;
  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
  values (v_workspace_id, (select auth.uid()), 'editor.rejected', 'editor', p_user_id,
          v_name || ' wasn''t taken on after onboarding');
end;
$$;

create or replace function public.end_shift_for(p_editor_id uuid, p_ended_at timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (select public.current_workspace_id());
  v_shift public.shifts;
  v_work integer;
  v_admin text;
  v_name text;
  v_tz text;
begin
  if not (select public.has_permission('attendance.view')) then
    raise exception 'Only an admin can end someone''s shift.' using errcode = '42501';
  end if;
  perform 1 from public.editors where workspace_id = v_workspace_id and id = p_editor_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select * into v_shift from public.shifts
  where workspace_id = v_workspace_id and editor_id = p_editor_id and clock_out_at is null;
  if not found then
    update public.editors
       set work_status = 'off', current_shift_id = null, current_task_id = null, status_since = now()
     where workspace_id = v_workspace_id and id = p_editor_id and work_status <> 'off';
    raise exception 'not_working' using errcode = 'P0001';
  end if;

  v_work := public.close_shift(v_shift.id, coalesce(p_ended_at, now()), 'admin');

  select full_name into v_admin from public.profiles where id = (select auth.uid());
  select full_name, timezone into v_name, v_tz from public.profiles where id = p_editor_id;

  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, meta)
  values (v_workspace_id, (select auth.uid()), 'editor.shift_ended', 'editor', p_editor_id,
          v_admin || ' ended ' || v_name || '''s shift · ' || public.format_duration(v_work),
          jsonb_build_object('shift_id', v_shift.id, 'seconds', v_work));

  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  select v_workspace_id, p_editor_id, 'shift_ended', v_admin || ' ended your shift',
         'Stopped at ' || to_char(s.clock_out_at at time zone coalesce(v_tz, 'UTC'), 'FMHH12:MI AM')
           || ' · ' || public.format_duration(v_work) || ' worked',
         '/attendance', 'shift', v_shift.id
  from public.shifts s where s.id = v_shift.id;

  return v_work;
end;
$$;

-- -----------------------------------------------------------------------------
-- Client messages (clients.manage): they read and answer client threads as
-- the company, like an admin. The team inbox stays with admins.
-- -----------------------------------------------------------------------------
create policy "delegated: read client threads" on public.message_threads
  for select to authenticated
  using (kind = 'client' and (select public.has_permission('clients.manage')));

create policy "delegated: read client messages" on public.messages
  for select to authenticated
  using ((select public.has_permission('clients.manage'))
         and exists (select 1 from public.message_threads t where t.id = thread_id and t.kind = 'client'));

create or replace function public.post_message(
  p_kind public.message_thread_kind,
  p_subject_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_workspace_id uuid := (select public.current_workspace_id());
  v_admin boolean := (select public.is_admin());
  v_body text := trim(p_body);
  v_sender public.message_sender;
  v_thread public.message_threads;
  v_name text;
  v_admins uuid[];
begin
  if v_user is null or v_workspace_id is null or not (select public.is_full_member()) then
    raise exception 'Only members of this workspace can send messages.' using errcode = '42501';
  end if;
  if v_body is null or v_body = '' then
    raise exception 'empty_message' using errcode = 'P0001';
  end if;
  if char_length(v_body) > 4000 then
    raise exception 'message_too_long' using errcode = 'P0001';
  end if;

  if p_kind = 'editor' then
    if not v_admin and p_subject_id is distinct from v_user then
      raise exception 'You can only write in your own inbox.' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.editors e
      join public.workspace_members m on m.workspace_id = e.workspace_id and m.user_id = e.id
      where e.workspace_id = v_workspace_id and e.id = p_subject_id and m.status = 'active'
    ) then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  else
    if not (select public.has_permission('clients.manage')) then
      raise exception 'Only admins write to clients.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.clients where id = p_subject_id and workspace_id = v_workspace_id) then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  -- The company side of a thread is "admin", whoever writes for it.
  v_sender := case when v_admin or p_kind = 'client' then 'admin' else 'editor' end;
  v_thread := public.thread_for(v_workspace_id, p_kind, p_subject_id);

  insert into public.messages (workspace_id, thread_id, sender, author_id, body)
  values (v_workspace_id, v_thread.id, v_sender, v_user, v_body);

  update public.message_threads
     set last_message_at = now(), last_message_preview = left(v_body, 160), last_sender = v_sender
   where id = v_thread.id;

  -- Writing in a thread means you've read it.
  insert into public.message_reads (workspace_id, thread_id, user_id, last_read_at)
  values (v_workspace_id, v_thread.id, v_user, now())
  on conflict (thread_id, user_id) do update set last_read_at = excluded.last_read_at;
  update public.notifications set read_at = now()
   where user_id = v_user and entity_type = 'thread' and entity_id = v_thread.id and read_at is null;

  select full_name into v_name from public.profiles where id = v_user;
  if v_sender = 'editor' then
    select array_agg(a.id) into v_admins from public.workspace_admin_ids(v_workspace_id) as a(id);
    perform public.notify_message(v_workspace_id, v_thread.id, coalesce(v_admins, '{}'), v_name, v_body,
                                  '/messages/team/' || v_user);
  elsif p_kind = 'editor' then
    perform public.notify_message(v_workspace_id, v_thread.id, array[p_subject_id], v_name, v_body, '/messages/team');
  end if;
  -- (A reply to a client is emailed to them by the app.)

  return v_thread.id;
end;
$$;

create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id
  from public.message_threads
  where id = p_thread_id
    and workspace_id = (select public.current_workspace_id())
    and ((select public.is_admin())
         or public.is_own_thread(id)
         or (kind = 'client' and (select public.has_permission('clients.manage'))));
  if not found or not (select public.is_full_member()) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.message_reads (workspace_id, thread_id, user_id, last_read_at)
  values (v_workspace_id, p_thread_id, (select auth.uid()), now())
  on conflict (thread_id, user_id) do update set last_read_at = excluded.last_read_at;

  update public.notifications set read_at = now()
   where user_id = (select auth.uid()) and entity_type = 'thread' and entity_id = p_thread_id and read_at is null;
end;
$$;

create or replace function public.unread_threads()
returns table (thread_id uuid, kind public.message_thread_kind)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.kind
  from public.message_threads t
  left join public.message_reads r on r.thread_id = t.id and r.user_id = (select auth.uid())
  where t.workspace_id = (select public.current_workspace_id())
    and (select public.is_full_member())
    and t.last_message_at is not null
    and t.last_message_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    and case
          when (select public.is_admin()) then t.last_sender <> 'admin'
          else (t.kind = 'editor' and t.editor_id = (select auth.uid()) and t.last_sender = 'admin')
            or (t.kind = 'client' and t.last_sender <> 'admin' and (select public.has_permission('clients.manage')))
        end;
$$;

-- -----------------------------------------------------------------------------
-- Workspace: brand, forms, contract, links
-- -----------------------------------------------------------------------------
create policy "delegated: update workspace" on public.workspaces
  for update to authenticated
  using (id = (select public.current_workspace_id())
         and ((select public.has_permission('workspace.brand'))
              or (select public.has_permission('workspace.contract'))
              or (select public.has_permission('workspace.links'))))
  with check (id = (select public.current_workspace_id())
              and ((select public.has_permission('workspace.brand'))
                   or (select public.has_permission('workspace.contract'))
                   or (select public.has_permission('workspace.links'))));

-- Each setting needs its own ability (owners and admins have them all).
create or replace function public.guard_workspace_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if (new.id, new.created_by, new.created_at) is distinct from (old.id, old.created_by, old.created_at) then
    raise exception 'That can''t be changed.' using errcode = '42501';
  end if;
  if (new.name, new.slug, new.default_accent, new.logo_path, new.accepting_applications, new.missed_clock_in_grace_minutes)
       is distinct from
     (old.name, old.slug, old.default_accent, old.logo_path, old.accepting_applications, old.missed_clock_in_grace_minutes)
     and not public.has_permission('workspace.brand') then
    raise exception 'You don''t have access to the workspace details.' using errcode = '42501';
  end if;
  if new.contract_template_url is distinct from old.contract_template_url
     and not public.has_permission('workspace.contract') then
    raise exception 'You don''t have access to the contract and NDA.' using errcode = '42501';
  end if;
  if (new.frameio_invite_url, new.asset_pack_url) is distinct from (old.frameio_invite_url, old.asset_pack_url)
     and not public.has_permission('workspace.links') then
    raise exception 'You don''t have access to the onboarding links.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_workspace_changes
  before update on public.workspaces
  for each row execute function public.guard_workspace_changes();

create policy "delegated: manage workspace logo" on storage.objects
  for all to authenticated
  using (bucket_id = 'workspace-logos' and (select public.has_permission('workspace.brand'))
         and (storage.foldername(name))[1] = (select public.current_workspace_id())::text)
  with check (bucket_id = 'workspace-logos' and (select public.has_permission('workspace.brand'))
              and (storage.foldername(name))[1] = (select public.current_workspace_id())::text);

create policy "delegated: edit forms" on public.workspace_forms
  for all to authenticated
  using ((select public.has_permission('workspace.forms')))
  with check ((select public.has_permission('workspace.forms')));

-- -----------------------------------------------------------------------------
-- Company: announcements.post, sops.manage
-- -----------------------------------------------------------------------------
create policy "delegated: post announcements" on public.announcements
  for all to authenticated
  using ((select public.has_permission('announcements.post')))
  with check ((select public.has_permission('announcements.post')));

create policy "delegated: manage sops" on public.sops
  for all to authenticated
  using ((select public.has_permission('sops.manage')))
  with check ((select public.has_permission('sops.manage')));
create policy "delegated: read acknowledgments" on public.sop_acknowledgments
  for select to authenticated using ((select public.has_permission('sops.manage')));
