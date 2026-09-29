-- =============================================================================
-- Foundry · 0014 · Notifications: email, reminders and alerts (Phase 6)
--   * Email. A notification still unread a minute after it arrives, while
--     its person isn't looking at Foundry, is emailed (grouped per person
--     and workspace). pg_cron checks every minute and, when something is
--     waiting, calls the app's /api/jobs/notifications through pg_net; the
--     app claims the rows with claim_notification_emails() and sends them
--     with Brevo. The app's URL and a shared secret live in Vault
--     (foundry_app_url, foundry_jobs_secret); without them nothing is sent.
--     People mute categories of email in Settings.
--   * Reminders and alerts, every five minutes, each sent once:
--       task due tomorrow        the editor, from 9:00 their time
--       task overdue             the editor and the admins
--       missed start of shift    the admins, after the grace period
--       quiet with overdue work  the admins: a work day they did start (or
--                                are still clocked in for), not seen for two
--                                hours, work overdue
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- -----------------------------------------------------------------------------
-- Email preferences
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column email_muted text[] not null default '{}'
    check (email_muted <@ array['tasks', 'messages', 'announcements', 'attendance', 'team']);

-- Which email setting a notification falls under. Null: never emailed from
-- here (new leads, applicants, interviews and approvals are emailed directly
-- when they happen).
create or replace function public.notification_email_category(p_type public.notification_type)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_type::text
    when 'task_assigned'        then 'tasks'
    when 'task_due_tomorrow'    then 'tasks'
    when 'revision_requested'   then 'tasks'
    when 'task_for_review'      then 'tasks'
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

-- Notifications waiting to be emailed, oldest first.
create or replace function public.pending_notification_emails(p_limit integer default 200)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select n.id
  from public.notifications n
  join public.profiles p on p.id = n.user_id
  join public.workspace_members m
    on m.workspace_id = n.workspace_id and m.user_id = n.user_id and m.status in ('onboarding', 'active')
  where n.emailed_at is null
    and n.read_at is null
    and n.created_at < now() - interval '1 minute'
    and n.created_at > now() - interval '1 day'
    and public.notification_email_category(n.type) is not null
    and not (public.notification_email_category(n.type) = any (p.email_muted))
    -- Someone looking at Foundry right now sees it there.
    and (p.last_seen_at is null or p.last_seen_at < now() - interval '3 minutes')
  order by n.created_at
  limit p_limit;
$$;

-- Marks waiting notifications as emailed and returns them with what the
-- email needs. Called by the app (service role) just before sending.
create or replace function public.claim_notification_emails(p_limit integer default 200)
returns table (
  id uuid,
  workspace_id uuid,
  user_id uuid,
  type public.notification_type,
  title text,
  body text,
  link text,
  created_at timestamptz,
  email text,
  full_name text,
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
    returning n.id, n.workspace_id, n.user_id, n.type, n.title, n.body, n.link, n.created_at
  )
  select c.id, c.workspace_id, c.user_id, c.type, c.title, c.body, c.link, c.created_at,
         p.email, p.full_name, w.name, w.default_accent
  from claimed c
  join public.profiles p on p.id = c.user_id
  join public.workspaces w on w.id = c.workspace_id
  order by c.user_id, c.workspace_id, c.created_at;
$$;

-- Asks the app to send waiting emails (pg_cron, every minute).
create or replace function public.request_notification_emails()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'foundry_app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'foundry_jobs_secret';
  if v_url is null or v_secret is null or not exists (select public.pending_notification_emails(1)) then
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/jobs/notifications',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.pending_notification_emails(integer) from public, anon, authenticated;
revoke all on function public.claim_notification_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_emails(integer) to service_role;
revoke all on function public.request_notification_emails() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Reminders and alerts
-- -----------------------------------------------------------------------------

-- What has been sent, so each alert goes out once. Only the functions here
-- use it.
create table public.alert_log (
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  kind          text not null,
  subject_id    uuid not null,
  for_date      date not null,
  created_at    timestamptz not null default now(),
  primary key (workspace_id, kind, subject_id, for_date)
);
alter table public.alert_log enable row level security;

create or replace function public.run_scheduled_alerts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Due tomorrow: the editor, from 9:00 their time.
  with due as (
    select t.id, t.workspace_id, t.assignee_id, t.title, t.due_date, p.name as project
    from public.tasks t
    join public.profiles pr on pr.id = t.assignee_id
    join public.workspace_members m
      on m.workspace_id = t.workspace_id and m.user_id = t.assignee_id and m.status = 'active'
    left join public.projects p on p.id = t.project_id
    where t.status <> 'done'
      and not t.is_trial
      and t.due_date between current_date - 1 and current_date + 2
      and t.due_date = (now() at time zone pr.timezone)::date + 1
      and (now() at time zone pr.timezone)::time >= time '09:00'
  ),
  fresh as (
    insert into public.alert_log (workspace_id, kind, subject_id, for_date)
    select workspace_id, 'task_due_tomorrow', id, due_date from due
    on conflict do nothing
    returning subject_id
  )
  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  select d.workspace_id, d.assignee_id, 'task_due_tomorrow', 'Due tomorrow: ' || d.title,
         coalesce(d.project, 'Internal'), '/tasks/' || d.id, 'task', d.id
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
end;
$$;

revoke all on function public.run_scheduled_alerts() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Schedules
-- -----------------------------------------------------------------------------
select cron.schedule('foundry-alerts', '*/5 * * * *', 'select public.run_scheduled_alerts()');
select cron.schedule('foundry-notification-emails', '* * * * *', 'select public.request_notification_emails()');
select cron.schedule(
  'foundry-cleanup',
  '17 3 * * *',
  $$delete from public.alert_log where for_date < current_date - 30;
    delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
