-- =============================================================================
-- ReEdit · Statuses in any order
--   * Task and project statuses now have one order per workspace, across
--     stages: an admin can put Client check before In Progress if that's how
--     the team works. It's the order of the board's columns and every status
--     menu. The stage still decides how each status behaves.
--   * "A stage's first status" (where a review or an older code path lands a
--     task) stays the first one of that stage in this order.
--   * Existing statuses keep the order they had (by stage, then as arranged),
--     numbered 1, 2, 3… per workspace; new workspaces start that way too.
-- =============================================================================

update public.task_statuses s
   set position = o.n
  from (
    select id, row_number() over (partition by workspace_id order by stage, position, created_at) as n
    from public.task_statuses
  ) o
 where o.id = s.id;

update public.project_statuses s
   set position = o.n
  from (
    select id, row_number() over (partition by workspace_id order by stage, position, created_at) as n
    from public.project_statuses
  ) o
 where o.id = s.id;

drop index public.task_statuses_stage_idx;
drop index public.project_statuses_stage_idx;
create index task_statuses_order_idx on public.task_statuses (workspace_id, position);
create index project_statuses_order_idx on public.project_statuses (workspace_id, position);

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
    (new.id, 'In Progress', 'blue',   'in_progress', 2),
    (new.id, 'For Review',  'yellow', 'for_review',  3),
    (new.id, 'Revisions',   'red',    'revisions',   4),
    (new.id, 'Done',        'green',  'done',        5);

  insert into public.project_statuses (workspace_id, name, color, stage, position)
  values
    (new.id, 'Brief Received',  'blue',   'brief_received',  1),
    (new.id, 'In Progress',     'accent', 'in_progress',     2),
    (new.id, 'Internal Review', 'yellow', 'internal_review', 3),
    (new.id, 'Client Review',   'orange', 'client_review',   4),
    (new.id, 'Revisions',       'red',    'revisions',       5),
    (new.id, 'Delivered',       'green',  'delivered',       6);
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reordering: the whole list in its new order, in one go (so two admins
-- dragging at once can't leave a half-applied order).
-- -----------------------------------------------------------------------------
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
  if not (select public.is_admin()) then
    raise exception 'Only an owner or admin can reorder statuses.' using errcode = '42501';
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

revoke all on function public.reorder_statuses(text, uuid[]) from public, anon;
grant execute on function public.reorder_statuses(text, uuid[]) to authenticated;
