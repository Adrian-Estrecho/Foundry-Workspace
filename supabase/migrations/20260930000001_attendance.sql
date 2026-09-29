-- =============================================================================
-- Foundry · 0012 · Attendance (Phase 5)
--   * Editors start and stop work, switch task and take breaks from the top
--     bar. These functions are the only write path for shifts, time logs and
--     status events (editors can only read their own rows).
--   * Stopping work files an end-of-shift report, and can backdate the end
--     when someone forgot to stop.
--   * Admins can end a shift an editor left running, at a time they choose.
--   * Reporting functions for the live board, daily log, timesheets and
--     hours per task. Security invoker, so RLS decides whose time you see.
-- =============================================================================

-- New notification types, added a migration before anything uses them (a
-- new enum value can't be used in the transaction that adds it).
alter type public.notification_type add value 'shift_ended';       -- editor: an admin ended their shift
alter type public.notification_type add value 'blocker_reported';  -- admin: an end-of-shift report names a blocker
alter type public.notification_type add value 'new_message';       -- anyone: a message in their inbox

-- Lookups the reports and the log make.
create index if not exists shifts_workspace_date_idx on public.shifts (workspace_id, work_date);
create index if not exists time_logs_shift_idx on public.time_logs (shift_id);

-- "6h 12m", "45m", "<1m", for feed lines and notifications.
create or replace function public.format_duration(p_seconds integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_seconds < 60 then '<1m'
    when p_seconds < 3600 then (p_seconds / 60) || 'm'
    when p_seconds % 3600 < 60 then (p_seconds / 3600) || 'h'
    else (p_seconds / 3600) || 'h ' || ((p_seconds % 3600) / 60) || 'm'
  end;
$$;

-- -----------------------------------------------------------------------------
-- Internal helpers
-- -----------------------------------------------------------------------------

-- The caller's editor record in their current workspace, locked until the
-- transaction ends. Only approved, active editors track time.
create or replace function public.my_editor_for_update()
returns public.editors
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_editor public.editors;
begin
  if not (select public.is_full_member()) then
    raise exception 'Only approved editors track their time.' using errcode = '42501';
  end if;
  select * into v_editor
  from public.editors
  where workspace_id = (select public.current_workspace_id()) and id = (select auth.uid())
  for update;
  if not found then
    raise exception 'Only editors track their time.' using errcode = '42501';
  end if;
  if not v_editor.is_active then
    raise exception 'inactive' using errcode = 'P0001';
  end if;
  return v_editor;
end;
$$;

-- A task the editor may log time against: theirs, open, real work. Returns
-- its title.
create or replace function public.work_task_title(p_workspace_id uuid, p_editor_id uuid, p_task_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  select title into v_title
  from public.tasks
  where id = p_task_id
    and workspace_id = p_workspace_id
    and assignee_id = p_editor_id
    and not is_trial
    and status <> 'done';
  if not found then
    raise exception 'task_unavailable' using errcode = 'P0001';
  end if;
  return v_title;
end;
$$;

-- Ends a shift at p_end (clamped between clock-in and now). Time logged
-- after the end doesn't count; the open log closes at the end. Fills in the
-- totals and puts the editor back to "off". Returns the seconds worked.
create or replace function public.close_shift(p_shift_id uuid, p_end timestamptz, p_ended_by text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.shifts;
  v_end timestamptz;
  v_work integer;
begin
  select * into v_shift from public.shifts where id = p_shift_id for update;
  if not found or v_shift.clock_out_at is not null then
    raise exception 'not_working' using errcode = 'P0001';
  end if;
  v_end := greatest(least(coalesce(p_end, now()), now()), v_shift.clock_in_at);

  delete from public.time_logs where shift_id = p_shift_id and started_at >= v_end and v_end < now();
  update public.time_logs
     set ended_at = v_end
   where shift_id = p_shift_id and (ended_at is null or ended_at > v_end);

  select coalesce(sum(extract(epoch from (ended_at - started_at))), 0)::integer into v_work
  from public.time_logs
  where shift_id = p_shift_id;

  update public.shifts
     set clock_out_at = v_end,
         work_seconds = v_work,
         break_seconds = greatest(0, extract(epoch from (v_end - clock_in_at))::integer - v_work),
         ended_by = p_ended_by
   where id = p_shift_id;

  insert into public.status_events (editor_id, shift_id, status, task_id, reason)
  values (v_shift.editor_id, p_shift_id, 'off', null, case when p_ended_by = 'admin' then 'admin' else 'clock_out' end);

  update public.editors
     set work_status = 'off', current_shift_id = null, current_task_id = null, status_since = now()
   where workspace_id = v_shift.workspace_id and id = v_shift.editor_id;

  return v_work;
end;
$$;

revoke all on function public.my_editor_for_update() from public, anon, authenticated;
revoke all on function public.work_task_title(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.close_shift(uuid, timestamptz, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Editor actions
-- -----------------------------------------------------------------------------

-- Start working, optionally on one of your tasks (a To Do task moves to In
-- Progress). Nobody works for two companies at once.
create or replace function public.start_work(p_task_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_editor public.editors := public.my_editor_for_update();
  v_elsewhere text;
  v_title text;
  v_tz text;
  v_name text;
  v_shift uuid;
begin
  if v_editor.work_status <> 'off' then
    raise exception 'already_working' using errcode = 'P0001';
  end if;
  select w.name into v_elsewhere
  from public.shifts s
  join public.workspaces w on w.id = s.workspace_id
  where s.editor_id = v_editor.id and s.clock_out_at is null
  limit 1;
  if v_elsewhere is not null then
    raise exception 'working_elsewhere' using errcode = 'P0001', detail = v_elsewhere;
  end if;
  if p_task_id is not null then
    v_title := public.work_task_title(v_editor.workspace_id, v_editor.id, p_task_id);
  end if;

  select timezone, full_name into v_tz, v_name from public.profiles where id = v_editor.id;

  insert into public.shifts (workspace_id, editor_id, clock_in_at, work_date)
  values (v_editor.workspace_id, v_editor.id, now(), (now() at time zone coalesce(v_tz, 'UTC'))::date)
  returning id into v_shift;

  insert into public.time_logs (editor_id, shift_id, task_id, started_at)
  values (v_editor.id, v_shift, p_task_id, now());
  insert into public.status_events (editor_id, shift_id, status, task_id, reason)
  values (v_editor.id, v_shift, 'working', p_task_id, 'clock_in');

  update public.editors
     set work_status = 'working', current_shift_id = v_shift, current_task_id = p_task_id, status_since = now()
   where workspace_id = v_editor.workspace_id and id = v_editor.id;

  if p_task_id is not null then
    update public.tasks set status = 'in_progress' where id = p_task_id and status = 'todo';
  end if;

  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
  values (v_editor.workspace_id, v_editor.id, 'editor.started_work', 'editor', v_editor.id,
          v_name || ' started working' || coalesce(' on ' || v_title, ''));
end;
$$;

-- Take a break: the clock on the current task stops.
create or replace function public.take_break()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_editor public.editors := public.my_editor_for_update();
  v_name text;
begin
  if v_editor.work_status <> 'working' then
    raise exception 'not_working' using errcode = 'P0001';
  end if;

  update public.time_logs set ended_at = now()
   where shift_id = v_editor.current_shift_id and ended_at is null;
  insert into public.status_events (editor_id, shift_id, status, task_id, reason)
  values (v_editor.id, v_editor.current_shift_id, 'on_break', v_editor.current_task_id, 'break');
  update public.editors
     set work_status = 'on_break', status_since = now()
   where workspace_id = v_editor.workspace_id and id = v_editor.id;

  select full_name into v_name from public.profiles where id = v_editor.id;
  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
  values (v_editor.workspace_id, v_editor.id, 'editor.took_break', 'editor', v_editor.id, v_name || ' is on a break');
end;
$$;

-- Back from a break, on the task you were on (if it's still yours) or
-- another one.
create or replace function public.resume_work(p_task_id uuid default null, p_keep_task boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_editor public.editors := public.my_editor_for_update();
  v_task uuid;
begin
  if v_editor.work_status <> 'on_break' then
    raise exception 'not_on_break' using errcode = 'P0001';
  end if;

  if p_task_id is not null then
    perform public.work_task_title(v_editor.workspace_id, v_editor.id, p_task_id);
    v_task := p_task_id;
  elsif p_keep_task and v_editor.current_task_id is not null then
    -- The task may have been reassigned or finished during the break.
    select id into v_task from public.tasks
    where id = v_editor.current_task_id
      and workspace_id = v_editor.workspace_id
      and assignee_id = v_editor.id
      and status <> 'done';
  end if;

  insert into public.time_logs (editor_id, shift_id, task_id, started_at)
  values (v_editor.id, v_editor.current_shift_id, v_task, now());
  insert into public.status_events (editor_id, shift_id, status, task_id, reason)
  values (v_editor.id, v_editor.current_shift_id, 'working', v_task, 'resume');
  update public.editors
     set work_status = 'working', current_task_id = v_task, status_since = now()
   where workspace_id = v_editor.workspace_id and id = v_editor.id;

  if v_task is not null then
    update public.tasks set status = 'in_progress' where id = v_task and status = 'todo';
  end if;
end;
$$;

-- Move the clock to another task (or to no specific task) without stopping.
create or replace function public.switch_task(p_task_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_editor public.editors := public.my_editor_for_update();
begin
  if v_editor.work_status <> 'working' then
    raise exception 'not_working' using errcode = 'P0001';
  end if;
  if p_task_id is not distinct from v_editor.current_task_id then
    return;
  end if;
  if p_task_id is not null then
    perform public.work_task_title(v_editor.workspace_id, v_editor.id, p_task_id);
  end if;

  update public.time_logs set ended_at = now()
   where shift_id = v_editor.current_shift_id and ended_at is null;
  insert into public.time_logs (editor_id, shift_id, task_id, started_at)
  values (v_editor.id, v_editor.current_shift_id, p_task_id, now());
  insert into public.status_events (editor_id, shift_id, status, task_id, reason)
  values (v_editor.id, v_editor.current_shift_id, 'working', p_task_id, 'task_switch');
  update public.editors
     set current_task_id = p_task_id, status_since = now()
   where workspace_id = v_editor.workspace_id and id = v_editor.id;

  if p_task_id is not null then
    update public.tasks set status = 'in_progress' where id = p_task_id and status = 'todo';
  end if;
end;
$$;

-- Stop working, with the end-of-shift report. p_ended_at backdates the end
-- when someone forgot to stop; p_progress updates the task they report on.
create or replace function public.stop_work(
  p_work_done text,
  p_blockers text default null,
  p_task_id uuid default null,
  p_progress integer default null,
  p_ended_at timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_editor public.editors := public.my_editor_for_update();
  v_work_done text := nullif(trim(p_work_done), '');
  v_blockers text := nullif(trim(p_blockers), '');
  v_shift uuid;
  v_work integer;
  v_name text;
begin
  if v_editor.work_status = 'off' then
    raise exception 'not_working' using errcode = 'P0001';
  end if;
  if v_work_done is null then
    raise exception 'report_required' using errcode = 'P0001';
  end if;
  if char_length(v_work_done) > 4000 or char_length(v_blockers) > 4000 then
    raise exception 'report_too_long' using errcode = 'P0001';
  end if;
  if p_progress is not null and p_progress not between 0 and 100 then
    raise exception 'invalid_progress' using errcode = 'P0001';
  end if;
  if p_task_id is not null and not exists (
    select 1 from public.tasks
    where id = p_task_id and workspace_id = v_editor.workspace_id and assignee_id = v_editor.id and not is_trial
  ) then
    raise exception 'task_unavailable' using errcode = 'P0001';
  end if;

  select id into v_shift from public.shifts
  where workspace_id = v_editor.workspace_id and editor_id = v_editor.id and clock_out_at is null;
  if v_shift is null then
    -- Nothing open (shouldn't happen): just put the editor back to off.
    update public.editors
       set work_status = 'off', current_shift_id = null, current_task_id = null, status_since = now()
     where workspace_id = v_editor.workspace_id and id = v_editor.id;
    return 0;
  end if;

  v_work := public.close_shift(v_shift, coalesce(p_ended_at, now()), 'editor');

  insert into public.shift_reports (shift_id, editor_id, task_id, work_done, blockers, progress_pct)
  values (v_shift, v_editor.id, p_task_id, v_work_done, v_blockers, p_progress);

  if p_task_id is not null and p_progress is not null then
    update public.tasks set progress_pct = p_progress
     where id = p_task_id and status <> 'done' and progress_pct is distinct from p_progress;
  end if;

  select full_name into v_name from public.profiles where id = v_editor.id;
  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, meta)
  values (v_editor.workspace_id, v_editor.id, 'editor.stopped_work', 'editor', v_editor.id,
          v_name || ' finished work · ' || public.format_duration(v_work),
          jsonb_build_object('shift_id', v_shift, 'seconds', v_work, 'blockers', v_blockers is not null));

  -- Blockers need someone's attention.
  if v_blockers is not null then
    insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
    select v_editor.workspace_id, a.id, 'blocker_reported', v_name || ' reported a blocker', left(v_blockers, 160),
           '/attendance?view=log&date=' || (select work_date from public.shifts where id = v_shift), 'editor', v_editor.id
    from public.workspace_admin_ids(v_editor.workspace_id) as a(id);
  end if;

  return v_work;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin action: end a shift someone left running
-- -----------------------------------------------------------------------------
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
  if not (select public.is_admin()) then
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

revoke all on function public.start_work(uuid) from public, anon;
grant execute on function public.start_work(uuid) to authenticated;
revoke all on function public.take_break() from public, anon;
grant execute on function public.take_break() to authenticated;
revoke all on function public.resume_work(uuid, boolean) from public, anon;
grant execute on function public.resume_work(uuid, boolean) to authenticated;
revoke all on function public.switch_task(uuid) from public, anon;
grant execute on function public.switch_task(uuid) to authenticated;
revoke all on function public.stop_work(text, text, uuid, integer, timestamptz) from public, anon;
grant execute on function public.stop_work(text, text, uuid, integer, timestamptz) to authenticated;
revoke all on function public.end_shift_for(uuid, timestamptz) from public, anon;
grant execute on function public.end_shift_for(uuid, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- Reports. Security invoker: an admin sees the team, an editor themselves.
-- Open shifts count up to now.
-- -----------------------------------------------------------------------------

-- Shifts by work date (the editor's own calendar day), with the
-- end-of-shift report.
create or replace function public.attendance_shifts(p_from date, p_to date)
returns table (
  id uuid,
  editor_id uuid,
  work_date date,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  work_seconds integer,
  break_seconds integer,
  ended_by text,
  work_done text,
  blockers text,
  progress_pct smallint,
  report_task_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id,
    s.editor_id,
    s.work_date,
    s.clock_in_at,
    s.clock_out_at,
    case when s.clock_out_at is null then coalesce(live.seconds, 0) else s.work_seconds end,
    case when s.clock_out_at is null
         then greatest(0, extract(epoch from (now() - s.clock_in_at))::integer - coalesce(live.seconds, 0))
         else s.break_seconds end,
    s.ended_by,
    r.work_done,
    r.blockers,
    r.progress_pct,
    r.task_id
  from public.shifts s
  left join public.shift_reports r on r.shift_id = s.id
  left join lateral (
    select sum(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at)))::integer as seconds
    from public.time_logs t
    where t.shift_id = s.id
  ) live on s.clock_out_at is null
  where s.work_date between p_from and p_to
  order by s.work_date desc, s.clock_in_at desc;
$$;

-- Time per editor and task, by the work date of the shift it was logged in
-- (so it adds up to the timesheets). A null task is time with no task picked,
-- or on a task that has since been deleted.
create or replace function public.attendance_hours(p_from date, p_to date)
returns table (editor_id uuid, task_id uuid, seconds bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.editor_id,
    t.task_id,
    sum(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at)))::bigint
  from public.time_logs t
  join public.shifts s on s.id = t.shift_id
  where s.work_date between p_from and p_to
  group by t.editor_id, t.task_id;
$$;

-- -----------------------------------------------------------------------------
-- Realtime: the daily log refreshes as shifts start and end
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.shifts;
