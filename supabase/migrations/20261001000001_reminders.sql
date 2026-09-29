-- =============================================================================
-- Foundry · 0015 · Task reminders and more alerts
--   * Start reminders. A task someone hands an editor that is still in To Do
--     after an hour of the editor's working time reminds them. Still in To Do
--     an hour after that, it reminds them again and tells the admins. That's
--     the last one. Working time is their scheduled hours (work days, from
--     their start time, for their usual day length) plus any time they're
--     clocked in, so a task assigned late at night waits for the morning. No
--     reminders while they're busy with another task In Progress; the clock
--     keeps running, so a reminder comes once they're free.
--   * Due tomorrow also tells the admins when the task isn't in review yet
--     (or nobody is on it). The editor gets a "due today" nudge at 9:00.
--     Neither fires for work handed over after 9:00 that day: the assignment
--     already said when it's due.
--   * Editors hear when their work is approved (For Review → Done).
--   * Notifications carry `meta` (e.g. which reminder, which tasks) for the
--     emails.
-- =============================================================================

alter type public.notification_type add value if not exists 'task_start_reminder';  -- editor
alter type public.notification_type add value if not exists 'task_not_started';     -- admin
alter type public.notification_type add value if not exists 'task_due_today';       -- editor
alter type public.notification_type add value if not exists 'task_approved';        -- editor

alter table public.notifications
  add column meta jsonb not null default '{}';

-- -----------------------------------------------------------------------------
-- Assignment bookkeeping
-- -----------------------------------------------------------------------------
alter table public.tasks
  -- When someone else handed the task to its assignee. Null when unassigned,
  -- or when the assignee took it themselves (no reminders then).
  add column assigned_at        timestamptz,
  -- Start reminders sent since then (0-2), and when the last one went.
  add column start_reminders    smallint not null default 0 check (start_reminders between 0 and 2),
  add column start_reminded_at  timestamptz;

-- Only the database sets these. A new assignee restarts the clock. (Named to
-- run after guard_task_changes.)
create or replace function public.stamp_task_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id then
    new.assigned_at := case when new.assignee_id is not null and new.assignee_id is distinct from v_actor then now() end;
    new.start_reminders := 0;
    new.start_reminded_at := null;
  elsif v_actor is not null then
    new.assigned_at := old.assigned_at;
    new.start_reminders := old.start_reminders;
    new.start_reminded_at := old.start_reminded_at;
  end if;
  return new;
end;
$$;

create trigger stamp_task_assignment
  before insert or update on public.tasks
  for each row execute function public.stamp_task_assignment();

-- Minutes of an editor's working time between two moments: their scheduled
-- hours (work days from shift_start, for weekly_hours spread over their work
-- days, 8 hours when unset, kept between 4 and 12) joined with the shifts
-- they actually clocked.
create or replace function public.editor_working_minutes(
  p_workspace_id uuid,
  p_editor_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with editor as (
    select e.shift_start, e.work_days, pr.timezone as tz,
           make_interval(mins => (least(greatest(
             coalesce(e.weekly_hours::numeric / nullif(cardinality(e.work_days), 0), 8), 4), 12) * 60)::integer) as day_length
    from public.editors e
    join public.profiles pr on pr.id = e.id
    where e.workspace_id = p_workspace_id and e.id = p_editor_id
  ),
  windows as (
    select tstzrange(start_at, start_at + ed.day_length) as r
    from editor ed
    cross join generate_series((p_from at time zone ed.tz)::date - 1, (p_to at time zone ed.tz)::date, interval '1 day') as d
    cross join lateral (select (d::date + ed.shift_start) at time zone ed.tz as start_at) s
    where extract(isodow from d)::smallint = any (ed.work_days)
    union all
    select tstzrange(sh.clock_in_at, coalesce(sh.clock_out_at, now()))
    from public.shifts sh
    where sh.workspace_id = p_workspace_id
      and sh.editor_id = p_editor_id
      and sh.clock_in_at < p_to
      and coalesce(sh.clock_out_at, now()) > p_from
  )
  select coalesce(sum(extract(epoch from upper(x) - lower(x))) / 60, 0)::integer
  from unnest(
    (select range_agg(r) from windows) * tstzmultirange(tstzrange(p_from, greatest(p_from, p_to)))
  ) as x;
$$;

revoke all on function public.editor_working_minutes(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Start reminders (called by run_scheduled_alerts)
-- -----------------------------------------------------------------------------
create or replace function public.run_task_start_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with due as (
    select t.id, t.workspace_id, t.assignee_id, t.title, t.due_date, t.assigned_at,
           t.start_reminders + 1 as nth, pr.full_name as editor, p.name as project
    from public.tasks t
    join public.editors e on e.workspace_id = t.workspace_id and e.id = t.assignee_id and e.is_active
    join public.workspace_members m
      on m.workspace_id = t.workspace_id and m.user_id = t.assignee_id and m.status = 'active'
    join public.profiles pr on pr.id = t.assignee_id
    left join public.projects p on p.id = t.project_id
    where t.status = 'todo'
      and not t.is_trial
      and t.start_reminders < 2
      and t.assigned_at > now() - interval '7 days'
      and not exists (
        select 1 from public.tasks busy
        where busy.workspace_id = t.workspace_id
          and busy.assignee_id = t.assignee_id
          and busy.status = 'in_progress'
          and busy.id <> t.id
      )
      and public.editor_working_minutes(t.workspace_id, t.assignee_id,
                                        coalesce(t.start_reminded_at, t.assigned_at), now()) >= 60
  ),
  marked as (
    update public.tasks t
       set start_reminders = d.nth, start_reminded_at = now()
      from due d
     where t.id = d.id and t.start_reminders = d.nth - 1
    returning t.id
  ),
  -- One notification per editor and round, however many tasks it covers.
  grouped as (
    select d.workspace_id, d.assignee_id, d.editor, d.nth, count(*)::integer as n,
           jsonb_agg(d.id order by d.due_date nulls last, d.assigned_at) as task_ids,
           (array_agg(d.id order by d.due_date nulls last, d.assigned_at))[1] as first_id,
           (array_agg(d.title order by d.due_date nulls last, d.assigned_at))[1] as first_title,
           (array_agg(concat_ws(' · ', d.project, 'Due ' || to_char(d.due_date, 'Mon FMDD'))
              order by d.due_date nulls last, d.assigned_at))[1] as first_meta,
           left(string_agg(d.title, ', ' order by d.due_date nulls last, d.assigned_at), 160) as titles
    from due d
    join marked using (id)
    group by d.workspace_id, d.assignee_id, d.editor, d.nth
  ),
  to_editor as (
    insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id, meta)
    select g.workspace_id, g.assignee_id, 'task_start_reminder',
           case when g.nth = 1 then 'Time to start ' else 'Second reminder: start ' end
             || case when g.n = 1 then g.first_title else g.n || ' tasks' end,
           case when g.n = 1 then nullif(g.first_meta, '') else g.titles end,
           case when g.n = 1 then '/tasks/' || g.first_id else '/my-tasks' end,
           case when g.n = 1 then 'task' end,
           case when g.n = 1 then g.first_id end,
           jsonb_build_object('reminder', g.nth, 'task_ids', g.task_ids)
    from grouped g
    returning 1
  )
  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id, meta)
  select g.workspace_id, a.id, 'task_not_started',
         g.editor || ' hasn''t started ' || case when g.n = 1 then g.first_title else g.n || ' tasks' end,
         case when g.n = 1 then concat_ws(' · ', nullif(g.first_meta, ''), 'Reminded twice') else g.titles end,
         case when g.n = 1 then '/tasks/' || g.first_id else '/editors/' || g.assignee_id end,
         case when g.n = 1 then 'task' else 'editor' end,
         case when g.n = 1 then g.first_id else g.assignee_id end,
         jsonb_build_object('editor_id', g.assignee_id, 'task_ids', g.task_ids)
  from grouped g
  cross join lateral public.workspace_admin_ids(g.workspace_id) as a(id)
  where g.nth = 2
    and a.id <> g.assignee_id;
end;
$$;

revoke all on function public.run_task_start_reminders() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Scheduled alerts: due tomorrow reaches the admins, due today, reminders
-- -----------------------------------------------------------------------------
create or replace function public.run_scheduled_alerts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Due tomorrow, from 9:00 the editor's time (UTC when nobody's on it): the
  -- editor, and the admins when it isn't in review yet.
  with due as (
    select t.id, t.workspace_id, t.assignee_id, t.title, t.due_date, t.status, pr.full_name as editor,
           p.name as project,
           exists (
             select 1 from public.workspace_members m
             where m.workspace_id = t.workspace_id and m.user_id = t.assignee_id and m.status = 'active'
           ) as assignee_active
    from public.tasks t
    left join public.profiles pr on pr.id = t.assignee_id
    left join public.projects p on p.id = t.project_id
    cross join lateral (select coalesce(pr.timezone, 'UTC') as tz) z
    where t.status <> 'done'
      and not t.is_trial
      and t.due_date between current_date - 1 and current_date + 2
      and t.due_date = (now() at time zone z.tz)::date + 1
      and (now() at time zone z.tz)::time >= time '09:00'
      and coalesce(t.assigned_at, t.created_at) < ((now() at time zone z.tz)::date + time '09:00') at time zone z.tz
  ),
  fresh as (
    insert into public.alert_log (workspace_id, kind, subject_id, for_date)
    select workspace_id, 'task_due_tomorrow', id, due_date from due
    on conflict do nothing
    returning subject_id
  )
  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  select d.workspace_id, r.user_id, 'task_due_tomorrow', 'Due tomorrow: ' || d.title,
         case when r.is_assignee then coalesce(d.project, 'Internal')
              else concat_ws(' · ', coalesce(d.editor, 'Nobody on it yet'), public.task_status_label(d.status), d.project)
         end,
         '/tasks/' || d.id, 'task', d.id
  from due d
  join fresh f on f.subject_id = d.id
  cross join lateral (
    select d.assignee_id as user_id, true as is_assignee
    where d.assignee_active
    union all
    select a.id, false
    from public.workspace_admin_ids(d.workspace_id) as a(id)
    where d.status <> 'for_review'
      and (a.id is distinct from d.assignee_id or not d.assignee_active)
  ) r;

  -- Due today: the editor, from 9:00 their time, when it isn't in review yet.
  with due as (
    select t.id, t.workspace_id, t.assignee_id, t.title, t.due_date, t.status, p.name as project
    from public.tasks t
    join public.profiles pr on pr.id = t.assignee_id
    join public.workspace_members m
      on m.workspace_id = t.workspace_id and m.user_id = t.assignee_id and m.status = 'active'
    left join public.projects p on p.id = t.project_id
    where t.status in ('todo', 'in_progress', 'revisions')
      and not t.is_trial
      and t.due_date between current_date - 1 and current_date + 1
      and t.due_date = (now() at time zone pr.timezone)::date
      and (now() at time zone pr.timezone)::time >= time '09:00'
      and coalesce(t.assigned_at, t.created_at) < (t.due_date + time '09:00') at time zone pr.timezone
  ),
  fresh as (
    insert into public.alert_log (workspace_id, kind, subject_id, for_date)
    select workspace_id, 'task_due_today', id, due_date from due
    on conflict do nothing
    returning subject_id
  )
  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  select d.workspace_id, d.assignee_id, 'task_due_today', 'Due today: ' || d.title,
         concat_ws(' · ', coalesce(d.project, 'Internal'), public.task_status_label(d.status)),
         '/tasks/' || d.id, 'task', d.id
  from due d
  join fresh f on f.subject_id = d.id;

  -- Overdue: the editor and the admins, the day after it was due (in the
  -- editor's time zone). Only recent due dates, so nothing old floods in.
  with late as (
    select t.id, t.workspace_id, t.assignee_id, t.title, t.due_date, pr.full_name as editor, p.name as project,
           exists (
             select 1 from public.workspace_members m
             where m.workspace_id = t.workspace_id and m.user_id = t.assignee_id and m.status = 'active'
           ) as assignee_active
    from public.tasks t
    left join public.profiles pr on pr.id = t.assignee_id
    left join public.projects p on p.id = t.project_id
    where t.status <> 'done'
      and not t.is_trial
      and t.due_date between current_date - 3 and current_date
      and t.due_date < (now() at time zone coalesce(pr.timezone, 'UTC'))::date
  ),
  fresh as (
    insert into public.alert_log (workspace_id, kind, subject_id, for_date)
    select workspace_id, 'task_overdue', id, due_date from late
    on conflict do nothing
    returning subject_id
  )
  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  select l.workspace_id, r.user_id, 'task_overdue', 'Overdue: ' || l.title,
         concat_ws(' · ', coalesce(l.editor, 'Unassigned'), l.project, 'was due ' || to_char(l.due_date, 'Mon FMDD')),
         '/tasks/' || l.id, 'task', l.id
  from late l
  join fresh f on f.subject_id = l.id
  cross join lateral (
    select a.id as user_id from public.workspace_admin_ids(l.workspace_id) as a(id)
    union
    select l.assignee_id where l.assignee_active
  ) r;

  -- Missed start: scheduled today, past their start time plus the
  -- workspace's grace period, and no shift yet today.
  with scheduled as (
    select e.workspace_id, e.id, pr.full_name, e.shift_start, e.work_days, pr.last_seen_at,
           w.missed_clock_in_grace_minutes as grace,
           (now() at time zone pr.timezone) as local_now
    from public.editors e
    join public.profiles pr on pr.id = e.id
    join public.workspaces w on w.id = e.workspace_id
    join public.workspace_members m on m.workspace_id = e.workspace_id and m.user_id = e.id
    where m.status = 'active'
      and m.role = 'editor'
      and coalesce(m.approved_at, m.joined_at) < now() - interval '1 day'
      and e.is_active
  ),
  due_now as (
    select s.*,
           s.local_now::date as local_date,
           (select count(*) from public.tasks t
             where t.workspace_id = s.workspace_id and t.assignee_id = s.id
               and t.status <> 'done' and not t.is_trial and t.due_date < s.local_now::date) as overdue
    from scheduled s
    where extract(isodow from s.local_now)::smallint = any (s.work_days)
      and extract(epoch from s.local_now::time) >= extract(epoch from s.shift_start) + s.grace * 60
  ),
  missed as (
    select d.* from due_now d
    join public.editors e on e.workspace_id = d.workspace_id and e.id = d.id
    where e.work_status = 'off'
      and not exists (
        select 1 from public.shifts sh
        where sh.workspace_id = d.workspace_id and sh.editor_id = d.id and sh.work_date = d.local_date
      )
  ),
  fresh as (
    insert into public.alert_log (workspace_id, kind, subject_id, for_date)
    select workspace_id, 'missed_clock_in', id, local_date from missed
    on conflict do nothing
    returning workspace_id, subject_id
  )
  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  select mi.workspace_id, a.id, 'missed_clock_in', mi.full_name || ' hasn''t started work',
         'Due at ' || to_char(mi.shift_start, 'FMHH12:MI AM') || ' their time'
           || case when mi.overdue > 0 then ' · ' || mi.overdue || case when mi.overdue = 1 then ' task' else ' tasks' end || ' overdue' else '' end,
         '/attendance', 'editor', mi.id
  from missed mi
  join fresh f on f.workspace_id = mi.workspace_id and f.subject_id = mi.id
  cross join lateral public.workspace_admin_ids(mi.workspace_id) as a(id);

  -- Quiet with overdue work: a work day, past their start, not seen for two
  -- hours, work overdue, and no missed-start alert already today.
  with scheduled as (
    select e.workspace_id, e.id, pr.full_name, e.shift_start, e.work_days, pr.last_seen_at, pr.timezone,
           w.missed_clock_in_grace_minutes as grace,
           (now() at time zone pr.timezone) as local_now
    from public.editors e
    join public.profiles pr on pr.id = e.id
    join public.workspaces w on w.id = e.workspace_id
    join public.workspace_members m on m.workspace_id = e.workspace_id and m.user_id = e.id
    where m.status = 'active'
      and m.role = 'editor'
      and e.is_active
      and (pr.last_seen_at is null or pr.last_seen_at < now() - interval '2 hours')
  ),
  quiet as (
    select s.*,
           s.local_now::date as local_date,
           (select count(*) from public.tasks t
             where t.workspace_id = s.workspace_id and t.assignee_id = s.id
               and t.status <> 'done' and not t.is_trial and t.due_date < s.local_now::date) as overdue
    from scheduled s
    where extract(isodow from s.local_now)::smallint = any (s.work_days)
      and extract(epoch from s.local_now::time) >= extract(epoch from s.shift_start) + s.grace * 60
      and not exists (
        select 1 from public.alert_log l
        where l.workspace_id = s.workspace_id and l.kind = 'missed_clock_in'
          and l.subject_id = s.id and l.for_date = s.local_now::date
      )
  ),
  flagged as (
    select * from quiet where overdue > 0
  ),
  fresh as (
    insert into public.alert_log (workspace_id, kind, subject_id, for_date)
    select workspace_id, 'offline_with_overdue', id, local_date from flagged
    on conflict do nothing
    returning workspace_id, subject_id
  )
  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  select fl.workspace_id, a.id, 'offline_with_overdue', fl.full_name || ' has gone quiet with work overdue',
         fl.overdue || case when fl.overdue = 1 then ' task' else ' tasks' end || ' overdue · '
           || coalesce('last seen ' || to_char(fl.last_seen_at at time zone fl.timezone, 'Dy FMHH12:MI AM') || ' their time',
                       'not seen yet'),
         '/editors/' || fl.id, 'editor', fl.id
  from flagged fl
  join fresh f on f.workspace_id = fl.workspace_id and f.subject_id = fl.id
  cross join lateral public.workspace_admin_ids(fl.workspace_id) as a(id);

  perform public.run_task_start_reminders();
end;
$$;

revoke all on function public.run_scheduled_alerts() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Approved: the editor hears when an admin marks their work done
-- -----------------------------------------------------------------------------
create or replace function public.notify_task_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_name text;
  v_editor text;
  v_project text;
  v_feedback text;
  v_editor_link text := case when new.is_trial then '/onboarding' else '/tasks/' || new.id end;
begin
  if new.assignee_id is null then
    return null;
  end if;
  select full_name into v_editor from public.profiles where id = new.assignee_id;
  select name into v_project from public.projects where id = new.project_id;

  -- Assigned (a new task, or handed to someone else)
  if (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and new.assignee_id is distinct from v_actor
     and new.status <> 'done' then
    insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
    values (
      new.workspace_id, new.assignee_id, 'task_assigned',
      case when new.is_trial then 'Your test edit: ' else 'New task: ' end || new.title,
      nullif(concat_ws(' · ', v_project, 'Due ' || to_char(new.due_date, 'Mon FMDD')), ''),
      v_editor_link, 'task', new.id
    );
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'for_review' then
      insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
      select new.workspace_id, a.id, 'task_for_review',
             case when new.is_trial then 'Test edit ready: ' || v_editor else 'Ready for review: ' || new.title end,
             case when new.is_trial then new.title else concat_ws(' · ', v_editor, v_project) end,
             case when new.is_trial then '/editors/' || new.assignee_id else '/tasks/' || new.id end,
             'task', new.id
      from public.workspace_admin_ids(new.workspace_id) as a(id)
      where a.id is distinct from v_actor;

    elsif new.status = 'revisions' and new.assignee_id is distinct from v_actor then
      -- Feedback is posted as a comment just before the status change.
      select left(c.body, 160) into v_feedback
      from public.task_comments c
      where c.task_id = new.id
        and c.author_id is not distinct from v_actor
        and c.created_at > now() - interval '5 minutes'
      order by c.created_at desc
      limit 1;

      insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
      values (
        new.workspace_id, new.assignee_id, 'revision_requested', 'Changes requested: ' || new.title,
        case when new.is_trial then 'See the feedback on your onboarding page'
             else coalesce(v_feedback, 'See the feedback on the task') end,
        v_editor_link, 'task', new.id
      );

    elsif new.status = 'done' and old.status = 'for_review' and not new.is_trial
          and new.assignee_id is distinct from v_actor then
      select full_name into v_actor_name from public.profiles where id = v_actor;
      insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
      values (
        new.workspace_id, new.assignee_id, 'task_approved', 'Approved: ' || new.title,
        concat_ws(' · ', v_project, coalesce(v_actor_name || ' marked it done', 'Marked done')),
        v_editor_link, 'task', new.id
      );
    end if;
  end if;

  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Email: the new types, and what the emails need
-- -----------------------------------------------------------------------------
create or replace function public.notification_email_category(p_type public.notification_type)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_type::text
    when 'task_assigned'        then 'tasks'
    when 'task_start_reminder'  then 'tasks'
    when 'task_not_started'     then 'tasks'
    when 'task_due_tomorrow'    then 'tasks'
    when 'task_due_today'       then 'tasks'
    when 'revision_requested'   then 'tasks'
    when 'task_for_review'      then 'tasks'
    when 'task_approved'        then 'tasks'
    when 'task_overdue'         then 'tasks'
    when 'mention'              then 'tasks'
    when 'new_message'          then 'messages'
    when 'new_announcement'     then 'announcements'
    when 'missed_clock_in'      then 'attendance'
    when 'offline_with_overdue' then 'attendance'
    when 'blocker_reported'     then 'attendance'
    when 'shift_ended'          then 'attendance'
    when 'member_joined'        then 'team'
    when 'onboarding_ready'     then 'team'
    when 'editor_onboarded'     then 'team'
  end;
$$;

drop function public.claim_notification_emails(integer);

-- Marks waiting notifications as emailed and returns them with what the
-- email needs. Called by the app (service role) just before sending.
create function public.claim_notification_emails(p_limit integer default 200)
returns table (
  id uuid,
  workspace_id uuid,
  user_id uuid,
  type public.notification_type,
  title text,
  body text,
  link text,
  entity_type text,
  entity_id uuid,
  meta jsonb,
  created_at timestamptz,
  email text,
  full_name text,
  timezone text,
  role public.member_role,
  workspace_name text,
  accent text
)
language sql
volatile
security definer
set search_path = ''
as $$
  with picked as (
    select n.id
    from public.notifications n
    where n.id in (select public.pending_notification_emails(p_limit))
    for update skip locked
  ),
  claimed as (
    update public.notifications n
       set emailed_at = now()
      from picked
     where n.id = picked.id
    returning n.id, n.workspace_id, n.user_id, n.type, n.title, n.body, n.link, n.entity_type, n.entity_id,
              n.meta, n.created_at
  )
  select c.id, c.workspace_id, c.user_id, c.type, c.title, c.body, c.link, c.entity_type, c.entity_id,
         c.meta, c.created_at, p.email, p.full_name, p.timezone, m.role, w.name, w.default_accent
  from claimed c
  join public.profiles p on p.id = c.user_id
  join public.workspaces w on w.id = c.workspace_id
  join public.workspace_members m on m.workspace_id = c.workspace_id and m.user_id = c.user_id
  order by c.user_id, c.workspace_id, c.created_at;
$$;

revoke all on function public.claim_notification_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_emails(integer) to service_role;
