-- =============================================================================
-- ReEdit · Editing synced ClickUp tasks
--   * Admins can now change a synced task's title, description, due date,
--     priority and assignee in ReEdit, not just its status. Each change is
--     queued in clickup_outbox (which fields changed; the values are read
--     when it goes out) and pushed to ClickUp by /api/jobs/clickup.
--   * The project still follows the ClickUp List, so it stays locked.
--   * clickup_people remembers the ClickUp accounts the sync has seen, by
--     email. ClickUp's API can't list guests, and an assignee chosen here has
--     to be found in ClickUp by their email.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ClickUp accounts by email (service role only)
-- -----------------------------------------------------------------------------
create table public.clickup_people (
  workspace_id     uuid not null references public.clickup_connections (workspace_id) on delete cascade,
  email            text not null check (email = lower(email)),
  clickup_user_id  bigint not null,
  name             text,
  seen_at          timestamptz not null default now(),
  primary key (workspace_id, email)
);
alter table public.clickup_people enable row level security;

-- -----------------------------------------------------------------------------
-- The outbox holds which fields changed instead of a target status
-- -----------------------------------------------------------------------------
alter table public.clickup_outbox
  add column fields text[] not null default '{}',
  -- Bumped by every change, so a push only clears the row it read.
  add column revision integer not null default 1;
update public.clickup_outbox set fields = '{status}';
alter table public.clickup_outbox drop column status_id;

-- -----------------------------------------------------------------------------
-- What people may do to synced tasks (the sync itself is never stopped)
--   * No new tasks in a linked project: they're added in ClickUp.
--   * The project follows the ClickUp List, so it can't change here.
--   * A move must land on a status the task's List has. When only a stage
--     was asked for (a review, Start work), the stage's first status the
--     List has is used.
-- Title, description, due date, priority and assignee can change (admins
-- only, as for any task: guard_task_changes); they're sent to ClickUp.
-- Runs after guard_task_changes (BEFORE triggers fire in name order), so the
-- status a stage stands for has been picked by then.
-- -----------------------------------------------------------------------------
create or replace function public.guard_clickup_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list text;
  v_first uuid;
  v_swap uuid;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.clickup_task_id is not null then
      raise exception 'Tasks from ClickUp are added by the sync.' using errcode = '42501';
    end if;
    if new.project_id is not null and exists (select 1 from public.clickup_pipelines where project_id = new.project_id) then
      raise exception 'This project is synced from ClickUp. Add the task in ClickUp and it shows up here.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.clickup_task_id is distinct from old.clickup_task_id then
    raise exception 'A task''s ClickUp link can''t be changed.' using errcode = '42501';
  end if;

  if old.clickup_task_id is null then
    if new.project_id is distinct from old.project_id
       and exists (select 1 from public.clickup_pipelines where project_id = new.project_id) then
      raise exception 'That project is synced from ClickUp. Add the task in ClickUp instead.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.project_id is distinct from old.project_id then
    raise exception 'This task comes from a ClickUp List, so it stays in that List''s project. Move it to another List in ClickUp instead.'
      using errcode = '42501';
  end if;

  if new.status_id is distinct from old.status_id and public.clickup_status_for(new.project_id, new.status_id) is null then
    select p.list_name into v_list from public.clickup_pipelines p where p.project_id = new.project_id;
    if v_list is null then
      return new;
    end if;

    select s.id into v_first
    from public.task_statuses s
    where s.workspace_id = new.workspace_id and s.stage = new.status
    order by s.position, s.created_at
    limit 1;

    if new.status_id = v_first then
      select s.id into v_swap
      from public.task_statuses s
      where s.workspace_id = new.workspace_id and s.stage = new.status
        and public.clickup_status_for(new.project_id, s.id) is not null
      order by s.position, s.created_at
      limit 1;
      if v_swap is null then
        raise exception 'ClickUp''s % list has no % status.', v_list, public.task_status_label(new.status)
          using errcode = 'P0001';
      end if;
      new.status_id := v_swap;
    else
      raise exception 'That status isn''t in ClickUp''s % list.', v_list using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Queueing people's changes for ClickUp
-- -----------------------------------------------------------------------------
drop trigger queue_clickup_status on public.tasks;
drop function public.queue_clickup_status();

-- A person changed a synced task: queue what changed. The sync's own
-- changes came from ClickUp, so they aren't sent back.
create or replace function public.queue_clickup_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields text[] := '{}';
begin
  if (select auth.uid()) is null then
    return null;
  end if;

  if new.status_id   is distinct from old.status_id   then v_fields := array_append(v_fields, 'status'); end if;
  if new.title       is distinct from old.title       then v_fields := array_append(v_fields, 'title'); end if;
  if new.description is distinct from old.description then v_fields := array_append(v_fields, 'description'); end if;
  if new.due_date    is distinct from old.due_date    then v_fields := array_append(v_fields, 'due_date'); end if;
  if new.priority    is distinct from old.priority    then v_fields := array_append(v_fields, 'priority'); end if;
  if new.assignee_id is distinct from old.assignee_id then v_fields := array_append(v_fields, 'assignee_id'); end if;
  if cardinality(v_fields) = 0 then
    return null;
  end if;

  insert into public.clickup_outbox (task_id, workspace_id, fields)
  values (new.id, new.workspace_id, v_fields)
  on conflict (task_id) do update
    set fields = array(select distinct f from unnest(public.clickup_outbox.fields || excluded.fields) as f order by f),
        revision = public.clickup_outbox.revision + 1,
        attempts = 0,
        next_attempt_at = now(),
        last_error = null,
        queued_at = now();

  perform public.request_clickup_push();
  return null;
end;
$$;

create trigger queue_clickup_push
  after update of status, status_id, title, description, due_date, priority, assignee_id on public.tasks
  for each row
  when (new.clickup_task_id is not null)
  execute function public.queue_clickup_push();

-- Changes ready to go out, with the task as it is now: the ClickUp status
-- its status stands for in its List (null when the List doesn't have one)
-- and the assignee's email.
drop function public.due_clickup_pushes(integer);
create function public.due_clickup_pushes(p_limit integer default 50)
returns table (
  task_id          uuid,
  workspace_id     uuid,
  revision         integer,
  attempts         smallint,
  fields           text[],
  clickup_task_id  text,
  title            text,
  description      text,
  due_date         date,
  priority         public.task_priority,
  assignee_email   text,
  list_id          text,
  list_name        text,
  clickup_status   text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.task_id, o.workspace_id, o.revision, o.attempts, o.fields, t.clickup_task_id, t.title, t.description,
         t.due_date, t.priority, lower(pr.email), p.list_id, p.list_name,
         public.clickup_status_for(t.project_id, t.status_id)
  from public.clickup_outbox o
  join public.tasks t on t.id = o.task_id
  left join public.profiles pr on pr.id = t.assignee_id
  left join public.clickup_pipelines p on p.project_id = t.project_id
  where o.next_attempt_at <= now()
  order by o.queued_at
  limit p_limit;
$$;

revoke all on function public.due_clickup_pushes(integer) from public, anon, authenticated;
grant execute on function public.due_clickup_pushes(integer) to service_role;
