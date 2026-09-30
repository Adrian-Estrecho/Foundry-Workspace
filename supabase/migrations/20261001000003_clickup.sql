-- =============================================================================
-- ReEdit · ClickUp pipelines
--   * A workspace connects its ClickUp with a personal API token, then links
--     ClickUp Lists ("pipelines") to projects. Tasks in a linked List come in
--     once they reach the pipeline's start status, and ClickUp's statuses
--     become the workspace's task statuses (clickup_status_map).
--   * ClickUp owns what a synced task is: its title, description, due date,
--     priority, assignee and project change only through the sync. People in
--     ReEdit still move it between statuses, and each move is queued in
--     clickup_outbox and pushed back to ClickUp by /api/jobs/clickup.
--   * The sync runs as the service role, so auth.uid() is null for its
--     changes: that's how the triggers here tell them from people's.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.clickup_connections (
  workspace_id   uuid primary key default public.current_workspace_id()
                   references public.workspaces (id) on delete cascade,
  team_id        text not null,
  team_name      text not null,
  -- Whose token it is: ClickUp shows every pushed status change as theirs.
  account_name   text not null,
  account_email  text,
  -- Null until the app has a public address ClickUp can call.
  webhook_id     text,
  -- ClickUp due dates are moments; they become dates in this time zone.
  timezone       text not null default 'UTC',
  connected_by   uuid references public.profiles (id) on delete set null,
  connected_at   timestamptz not null default now(),
  last_event_at  timestamptz,
  last_error     text,
  last_error_at  timestamptz
);

-- The token and webhook secret. RLS with no policies: only the service role
-- reads them.
create table public.clickup_secrets (
  workspace_id    uuid primary key references public.clickup_connections (workspace_id) on delete cascade,
  api_token       text not null,
  webhook_secret  text
);

create table public.clickup_pipelines (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null default public.current_workspace_id()
                    references public.clickup_connections (workspace_id) on delete cascade,
  list_id         text not null,
  list_name       text not null,
  project_id      uuid not null references public.projects (id) on delete cascade,
  -- ClickUp status (lower case) where syncing starts; earlier ones stay in ClickUp.
  start_status    text not null check (start_status = lower(start_status)),
  -- The List's statuses as ClickUp last described them:
  -- [{ "name": "under review", "type": "custom", "orderindex": 5, "color": "#..." }]
  statuses        jsonb not null default '[]'::jsonb,
  last_synced_at  timestamptz,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (workspace_id, list_id),
  unique (project_id)
);

-- Which workspace status each ClickUp status (by name, lower case) is.
create table public.clickup_status_map (
  workspace_id    uuid not null default public.current_workspace_id()
                    references public.clickup_connections (workspace_id) on delete cascade,
  clickup_status  text not null check (clickup_status = lower(clickup_status)),
  status_id       uuid not null,
  -- Added by the sync when ClickUp got a new status; an admin checks its stage.
  needs_review    boolean not null default false,
  primary key (workspace_id, clickup_status),
  foreign key (workspace_id, status_id) references public.task_statuses (workspace_id, id) on delete cascade
);
create index clickup_status_map_status_idx on public.clickup_status_map (status_id);

alter table public.tasks
  add column clickup_task_id text,
  add constraint tasks_clickup_task_key unique (workspace_id, clickup_task_id);

-- Status moves made in ReEdit, waiting to reach ClickUp. One row per task:
-- a newer move replaces an older one that hasn't gone out yet.
create table public.clickup_outbox (
  task_id          uuid primary key references public.tasks (id) on delete cascade,
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  status_id        uuid not null,
  attempts         smallint not null default 0,
  next_attempt_at  timestamptz not null default now(),
  last_error       text,
  queued_at        timestamptz not null default now()
);
create index clickup_outbox_due_idx on public.clickup_outbox (next_attempt_at);

create trigger set_workspace_id before update on public.clickup_pipelines
  for each row execute function public.set_workspace_id();
create trigger set_workspace_id before update on public.clickup_status_map
  for each row execute function public.set_workspace_id();

-- -----------------------------------------------------------------------------
-- Access: owners and admins see and manage the connection and pipelines.
-- Secrets and the outbox are for the service role only.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['clickup_connections', 'clickup_pipelines', 'clickup_status_map'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "current workspace only" on public.%I
         as restrictive for all to authenticated
         using (workspace_id = (select public.current_workspace_id()))
         with check (workspace_id = (select public.current_workspace_id()))', t);
    execute format(
      'create policy "admins manage clickup" on public.%I
         for all to authenticated
         using ((select public.is_admin()))
         with check ((select public.is_admin()))', t);
  end loop;
end;
$$;

alter table public.clickup_secrets enable row level security;
alter table public.clickup_outbox enable row level security;

-- -----------------------------------------------------------------------------
-- The ClickUp status a workspace status stands for in a project's List, or
-- null when that List doesn't have it.
-- -----------------------------------------------------------------------------
create or replace function public.clickup_status_for(p_project_id uuid, p_status_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s ->> 'name'
  from public.clickup_pipelines p
  cross join lateral jsonb_array_elements(p.statuses) as s
  join public.clickup_status_map m
    on m.workspace_id = p.workspace_id and m.clickup_status = s ->> 'name'
  where p.project_id = p_project_id
    and m.status_id = p_status_id
  order by (s ->> 'orderindex')::int
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- What people may do to synced tasks (the sync itself is never stopped)
--   * No new tasks in a linked project: they're added in ClickUp.
--   * Title, description, due date, priority, assignee and project are
--     ClickUp's.
--   * A move must land on a status the task's List has. When only a stage
--     was asked for (a review, Start work), the stage's first status the
--     List has is used.
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

  if new.title       is distinct from old.title
  or new.description is distinct from old.description
  or new.due_date    is distinct from old.due_date
  or new.priority    is distinct from old.priority
  or new.assignee_id is distinct from old.assignee_id
  or new.project_id  is distinct from old.project_id then
    raise exception 'This task comes from ClickUp. Change it there and it updates here.' using errcode = '42501';
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

create trigger sync_clickup_task
  before insert or update on public.tasks
  for each row execute function public.guard_clickup_task();

-- -----------------------------------------------------------------------------
-- Pushing moves to ClickUp
-- -----------------------------------------------------------------------------

-- Asks the app to push waiting moves (right after a move, and every minute
-- for retries), with the URL and secret the notification emails use.
create or replace function public.request_clickup_push()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.clickup_outbox where next_attempt_at <= now()) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'foundry_app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'foundry_jobs_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/jobs/clickup',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 30000
  );
end;
$$;

-- A person moved a synced task: queue the move for ClickUp. The sync's own
-- changes came from ClickUp, so they aren't sent back.
create or replace function public.queue_clickup_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return null;
  end if;

  insert into public.clickup_outbox (task_id, workspace_id, status_id)
  values (new.id, new.workspace_id, new.status_id)
  on conflict (task_id) do update
    set status_id = excluded.status_id,
        attempts = 0,
        next_attempt_at = now(),
        last_error = null,
        queued_at = now();

  perform public.request_clickup_push();
  return null;
end;
$$;

create trigger queue_clickup_status
  after update of status, status_id on public.tasks
  for each row
  when (new.clickup_task_id is not null and new.status_id is distinct from old.status_id)
  execute function public.queue_clickup_status();

-- Moves ready to go out, with the ClickUp status each stands for in the
-- task's List (null when the List no longer has one).
create or replace function public.due_clickup_pushes(p_limit integer default 50)
returns table (
  task_id          uuid,
  workspace_id     uuid,
  status_id        uuid,
  attempts         smallint,
  clickup_task_id  text,
  title            text,
  list_name        text,
  clickup_status   text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.task_id, o.workspace_id, o.status_id, o.attempts, t.clickup_task_id, t.title, p.list_name,
         public.clickup_status_for(t.project_id, o.status_id)
  from public.clickup_outbox o
  join public.tasks t on t.id = o.task_id
  left join public.clickup_pipelines p on p.project_id = t.project_id
  where o.next_attempt_at <= now()
  order by o.queued_at
  limit p_limit;
$$;

revoke all on function public.clickup_status_for(uuid, uuid) from public, anon, authenticated;
revoke all on function public.request_clickup_push() from public, anon, authenticated;
revoke all on function public.due_clickup_pushes(integer) from public, anon, authenticated;
grant execute on function public.due_clickup_pushes(integer) to service_role;

select cron.schedule('foundry-clickup-push', '* * * * *', 'select public.request_clickup_push()');
