-- =============================================================================
-- ReEdit · Custom statuses
--   * Each workspace has its own task statuses and project statuses. Owners
--     and admins add, rename, recolour, reorder and remove them.
--   * Every status belongs to a stage: one of the fixed task_status /
--     project_status values. The stage carries the rules (editors stop at
--     For Review, Done completes a task, Delivered closes a project, the
--     client portal's wording), so a custom status behaves like its stage.
--   * tasks.status and projects.status stay the stage; the new status_id is
--     the workspace's status. Setting either keeps the other in step, so code
--     that sets a stage (e.g. a review's "done") lands in that stage's first
--     status.
--   * Each stage keeps at least one status. Removing a status moves what's in
--     it to another status of the same stage (delete_task_status and
--     delete_project_status), without notifications or feed entries.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.task_statuses (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null default public.current_workspace_id()
                  references public.workspaces (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40 and name = btrim(name)),
  color         text not null default 'grey'
                  check (color in ('grey', 'blue', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'accent')),
  stage         public.task_status not null,
  position      double precision not null default 0,
  created_at    timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index task_statuses_name_key on public.task_statuses (workspace_id, lower(name));
create index task_statuses_stage_idx on public.task_statuses (workspace_id, stage, position);

create table public.project_statuses (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null default public.current_workspace_id()
                  references public.workspaces (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40 and name = btrim(name)),
  color         text not null default 'grey'
                  check (color in ('grey', 'blue', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'accent')),
  stage         public.project_status not null,
  position      double precision not null default 0,
  created_at    timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index project_statuses_name_key on public.project_statuses (workspace_id, lower(name));
create index project_statuses_stage_idx on public.project_statuses (workspace_id, stage, position);

create trigger set_workspace_id before update on public.task_statuses
  for each row execute function public.set_workspace_id();
create trigger set_workspace_id before update on public.project_statuses
  for each row execute function public.set_workspace_id();

-- -----------------------------------------------------------------------------
-- Access: everyone in the workspace reads them, admins add and edit them.
-- There is no delete policy: removing goes through the delete_* functions,
-- which move tasks and projects out first.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['task_statuses', 'project_statuses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "current workspace only" on public.%I
         as restrictive for all to authenticated
         using (workspace_id = (select public.current_workspace_id()))
         with check (workspace_id = (select public.current_workspace_id()))', t);
    execute format(
      'create policy "members read statuses" on public.%I
         for select to authenticated
         using (true)', t);
    execute format(
      'create policy "admins add statuses" on public.%I
         for insert to authenticated
         with check ((select public.is_admin()))', t);
    execute format(
      'create policy "admins edit statuses" on public.%I
         for update to authenticated
         using ((select public.is_admin()))
         with check ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- A stage can't change while something is in the status, and a stage can't
-- be left without a status.
-- -----------------------------------------------------------------------------
create or replace function public.guard_status_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_in_use boolean;
  v_others boolean;
begin
  if new.stage::text is distinct from old.stage::text then
    execute format('select exists (select 1 from public.%I where status_id = $1)', tg_argv[0])
      into v_in_use using old.id;
    if v_in_use then
      raise exception '% are in this status, so its stage can''t change. Add a new status instead.', initcap(tg_argv[0])
        using errcode = 'P0001';
    end if;
    execute format('select exists (select 1 from public.%I where workspace_id = $1 and stage::text = $2 and id <> $3)', tg_table_name)
      into v_others using old.workspace_id, old.stage::text, old.id;
    if not v_others then
      raise exception 'Every stage needs at least one status.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_status_changes before update of stage on public.task_statuses
  for each row execute function public.guard_status_changes('tasks');
create trigger guard_status_changes before update of stage on public.project_statuses
  for each row execute function public.guard_status_changes('projects');

-- -----------------------------------------------------------------------------
-- Default statuses: the built-in ones, for every new workspace
-- -----------------------------------------------------------------------------
create or replace function public.seed_workspace_statuses()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_statuses (workspace_id, name, color, stage, position)
  values
    (new.id, 'To Do',       'grey',   'todo',        1),
    (new.id, 'In Progress', 'blue',   'in_progress', 1),
    (new.id, 'For Review',  'yellow', 'for_review',  1),
    (new.id, 'Revisions',   'red',    'revisions',   1),
    (new.id, 'Done',        'green',  'done',        1);

  insert into public.project_statuses (workspace_id, name, color, stage, position)
  values
    (new.id, 'Brief Received',  'blue',   'brief_received',  1),
    (new.id, 'In Progress',     'accent', 'in_progress',     1),
    (new.id, 'Internal Review', 'yellow', 'internal_review', 1),
    (new.id, 'Client Review',   'orange', 'client_review',   1),
    (new.id, 'Revisions',       'red',    'revisions',       1),
    (new.id, 'Delivered',       'green',  'delivered',       1);
  return null;
end;
$$;

create trigger seed_workspace_statuses after insert on public.workspaces
  for each row execute function public.seed_workspace_statuses();

-- Existing workspaces get the same set.
do $$
declare
  w record;
begin
  for w in select id from public.workspaces loop
    insert into public.task_statuses (workspace_id, name, color, stage, position)
    values
      (w.id, 'To Do',       'grey',   'todo',        1),
      (w.id, 'In Progress', 'blue',   'in_progress', 1),
      (w.id, 'For Review',  'yellow', 'for_review',  1),
      (w.id, 'Revisions',   'red',    'revisions',   1),
      (w.id, 'Done',        'green',  'done',        1);
    insert into public.project_statuses (workspace_id, name, color, stage, position)
    values
      (w.id, 'Brief Received',  'blue',   'brief_received',  1),
      (w.id, 'In Progress',     'accent', 'in_progress',     1),
      (w.id, 'Internal Review', 'yellow', 'internal_review', 1),
      (w.id, 'Client Review',   'orange', 'client_review',   1),
      (w.id, 'Revisions',       'red',    'revisions',       1),
      (w.id, 'Delivered',       'green',  'delivered',       1);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- status_id on tasks and projects (filled in without firing the usual
-- triggers: nothing actually moved)
-- -----------------------------------------------------------------------------
alter table public.tasks add column status_id uuid;
alter table public.projects add column status_id uuid;

alter table public.tasks disable trigger user;
update public.tasks t
   set status_id = s.id
  from public.task_statuses s
 where s.workspace_id = t.workspace_id and s.stage = t.status;
alter table public.tasks enable trigger user;

alter table public.projects disable trigger user;
update public.projects p
   set status_id = s.id
  from public.project_statuses s
 where s.workspace_id = p.workspace_id and s.stage = p.status;
alter table public.projects enable trigger user;

-- Always set, but by the triggers below, so inserts needn't pass it: a check
-- rather than NOT NULL keeps it optional in the generated insert types.
alter table public.tasks
  add constraint tasks_status_id_set check (status_id is not null),
  add constraint tasks_status_id_fkey foreign key (workspace_id, status_id)
    references public.task_statuses (workspace_id, id);
create index tasks_status_id_idx on public.tasks (status_id);

alter table public.projects
  add constraint projects_status_id_set check (status_id is not null),
  add constraint projects_status_id_fkey foreign key (workspace_id, status_id)
    references public.project_statuses (workspace_id, id);
create index projects_status_id_idx on public.projects (status_id);

-- -----------------------------------------------------------------------------
-- Task invariants (replaces the Phase 4 version)
--   * status_id and status (the stage) stay in step: a new status_id sets the
--     stage; a new stage on its own picks that stage's first status.
--   * Editors may move their tasks between statuses in the To Do /
--     In Progress / For Review stages and update progress, but only an admin
--     can move a task into a Done or Revisions status, reopen a Done task,
--     or change what the task is.
--   * Entering Revisions bumps revision_count; Done stamps completed_at.
-- Runs before set_workspace_id (trigger order is by name), so on insert the
-- workspace comes from the project when there is one.
-- -----------------------------------------------------------------------------
create or replace function public.guard_task_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_workspace uuid := new.workspace_id;
  v_stage public.task_status;
  v_name text;
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

  if tg_op = 'UPDATE' and (select auth.uid()) is not null and not public.is_admin() then
    if new.project_id     is distinct from old.project_id
    or new.assignee_id    is distinct from old.assignee_id
    or new.title          is distinct from old.title
    or new.description    is distinct from old.description
    or new.due_date       is distinct from old.due_date
    or new.priority       is distinct from old.priority
    or new.revision_count is distinct from old.revision_count
    or new.is_trial       is distinct from old.is_trial
    or new.idea_id        is distinct from old.idea_id
    or new.created_by     is distinct from old.created_by then
      raise exception 'Editors can only change the status and progress of their tasks.'
        using errcode = '42501';
    end if;

    if new.status_id is distinct from old.status_id then
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

-- -----------------------------------------------------------------------------
-- Project status and stage in step (and Delivered stamps delivered_at)
-- Runs after set_workspace_id, so new.workspace_id is the client's.
-- -----------------------------------------------------------------------------
create or replace function public.touch_project_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_stage public.project_status;
begin
  if new.status_id is not null and (tg_op = 'INSERT' or new.status_id is distinct from old.status_id) then
    select s.stage into v_stage
    from public.project_statuses s
    where s.id = new.status_id and s.workspace_id = new.workspace_id;
    if v_stage is null then
      raise exception 'That status no longer exists. Refresh and try again.' using errcode = '23503';
    end if;
    new.status := v_stage;
  elsif new.status_id is null or new.status is distinct from old.status then
    new.status_id := (
      select s.id from public.project_statuses s
      where s.workspace_id = new.workspace_id and s.stage = new.status
      order by s.position, s.created_at
      limit 1
    );
  end if;

  if new.status = 'delivered' then
    if tg_op = 'INSERT' or old.status <> 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
    end if;
  else
    new.delivered_at := null;
  end if;
  return new;
end;
$$;

drop trigger touch_project_status on public.projects;
create trigger touch_project_status
  before insert or update of status, status_id on public.projects
  for each row execute function public.touch_project_status();

-- -----------------------------------------------------------------------------
-- Triggers that watch the status also watch status_id (the app sets only
-- status_id, and column triggers ignore changes made by BEFORE triggers)
-- -----------------------------------------------------------------------------
drop trigger notify_task_changes on public.tasks;
create trigger notify_task_changes
  after insert or update of status, status_id, assignee_id on public.tasks
  for each row execute function public.notify_task_changes();

drop trigger on_trial_task_done on public.tasks;
create trigger on_trial_task_done
  after insert or update of status, status_id on public.tasks
  for each row
  when (new.is_trial and new.status = 'done' and new.assignee_id is not null)
  execute function public.on_trial_task_done();

-- -----------------------------------------------------------------------------
-- Activity feed: "moved to <status>" uses the workspace's own name. Moves
-- made while a status is removed aren't logged.
-- -----------------------------------------------------------------------------
create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_name text;
  v_editor text;
  v_status text;
begin
  select full_name into v_actor_name from public.profiles where id = v_actor;
  select full_name into v_editor from public.profiles where id = new.assignee_id;

  if tg_op = 'INSERT' then
    -- Test edits are logged by the onboarding flow.
    if not new.is_trial then
      insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
      values (new.workspace_id, v_actor, 'task.created', 'task', new.id,
              'New task: ' || new.title || coalesce(' for ' || v_editor, ''));
    end if;
    return null;
  end if;

  if new.status_id is distinct from old.status_id
     and coalesce(current_setting('reedit.removing_status', true), '') <> 'on' then
    select name into v_status from public.task_statuses where id = new.status_id;
    insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, meta)
    values (new.workspace_id, v_actor, 'task.status_changed', 'task', new.id,
            case when v_actor_name is null then new.title || ' moved to '
                 else v_actor_name || ' moved ' || new.title || ' to ' end
            || coalesce(v_status, public.task_status_label(new.status)),
            jsonb_build_object('from', old.status, 'to', new.status, 'from_status', old.status_id, 'to_status', new.status_id));
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, meta)
    values (new.workspace_id, v_actor, 'task.reassigned', 'task', new.id,
            case when v_editor is null then new.title || ' is now unassigned'
                 else new.title || ' reassigned to ' || v_editor end,
            jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
  end if;

  return null;
end;
$$;

drop trigger log_task_activity on public.tasks;
create trigger log_task_activity
  after insert or update of status, status_id, assignee_id on public.tasks
  for each row execute function public.log_task_activity();

create or replace function public.log_project_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if coalesce(current_setting('reedit.removing_status', true), '') = 'on' then
    return null;
  end if;
  select name into v_status from public.project_statuses where id = new.status_id;
  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, meta)
  values (new.workspace_id, (select auth.uid()), 'project.status_changed', 'project', new.id,
          new.name || ' moved to ' || coalesce(v_status, public.project_status_label(new.status)),
          jsonb_build_object('from', old.status, 'to', new.status, 'from_status', old.status_id, 'to_status', new.status_id));
  return null;
end;
$$;

drop trigger log_project_status on public.projects;
create trigger log_project_status
  after update of status, status_id on public.projects
  for each row
  when (new.status_id is distinct from old.status_id)
  execute function public.log_project_status();

-- -----------------------------------------------------------------------------
-- Removing a status: what's in it moves to another status of the same stage
-- (so nothing changes stage, and nobody is notified), then it's deleted.
-- -----------------------------------------------------------------------------
create or replace function public.delete_task_status(p_status_id uuid, p_move_to uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.task_statuses%rowtype;
begin
  if not (select public.is_admin()) then
    raise exception 'Only an owner or admin can remove statuses.' using errcode = '42501';
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
  if not (select public.is_admin()) then
    raise exception 'Only an owner or admin can remove statuses.' using errcode = '42501';
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

revoke all on function public.delete_task_status(uuid, uuid) from public, anon;
grant execute on function public.delete_task_status(uuid, uuid) to authenticated;
revoke all on function public.delete_project_status(uuid, uuid) from public, anon;
grant execute on function public.delete_project_status(uuid, uuid) to authenticated;
revoke all on function public.seed_workspace_statuses() from public, anon, authenticated;
revoke all on function public.guard_status_changes() from public, anon, authenticated;
