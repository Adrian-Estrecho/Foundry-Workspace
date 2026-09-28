-- =============================================================================
-- Foundry · 0002 · Core behaviour
-- Shared triggers, role helpers, auth hooks, presence, and the aggregate
-- functions used by the dashboard. Module-specific automation (pipelines,
-- attendance, notifications) is added by later migrations.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- updated_at bookkeeping
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'app_settings', 'clients', 'applicants', 'editors',
    'editor_payment_details', 'projects', 'tasks', 'announcements', 'sops'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Role helpers (security definer so policies can call them without recursing
-- into the RLS of the tables they read)
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- True when the current user is an editor on the project, either as a project
-- member or through a task assigned to them in it.
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_editors
    where project_id = p_project_id and editor_id = (select auth.uid())
  ) or exists (
    select 1 from public.tasks
    where project_id = p_project_id and assignee_id = (select auth.uid())
  );
$$;

create or replace function public.is_task_assignee(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks
    where id = p_task_id and assignee_id = (select auth.uid())
  );
$$;

-- -----------------------------------------------------------------------------
-- New auth user → profile (+ editor record)
--
-- Role comes from app_metadata, which only the service role can set, so a
-- user can never choose their own role. When an applicant is approved the
-- server passes `applicant_id`, and the editor record is filled from the
-- application.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role :=
    coalesce(nullif(new.raw_app_meta_data ->> 'role', '')::public.user_role, 'editor');
  v_applicant public.applicants%rowtype;
begin
  if nullif(new.raw_app_meta_data ->> 'applicant_id', '') is not null then
    select * into v_applicant
    from public.applicants
    where id = (new.raw_app_meta_data ->> 'applicant_id')::uuid;
  end if;

  insert into public.profiles (id, role, full_name, email, timezone)
  values (
    new.id,
    v_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), v_applicant.full_name, split_part(new.email, '@', 1)),
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), v_applicant.timezone, 'UTC')
  );

  if v_role = 'editor' then
    insert into public.editors (id, applicant_id, software, specialties, hourly_rate, weekly_hours)
    values (
      new.id,
      v_applicant.id,
      coalesce(v_applicant.software, '{}'),
      coalesce(v_applicant.specialties, '{}'),
      v_applicant.hourly_rate,
      v_applicant.weekly_hours
    );

    if v_applicant.id is not null then
      update public.applicants set editor_id = new.id where id = v_applicant.id;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in step with auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Editors may edit their own profile, but not their role or email.
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    if new.role is distinct from old.role or new.email is distinct from old.email then
      raise exception 'You cannot change your role or email here.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_profile_changes
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- -----------------------------------------------------------------------------
-- Editor onboarding checklist, created with every editor
-- -----------------------------------------------------------------------------
create or replace function public.seed_editor_checklist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.editor_checklist_items (editor_id, key, label, position)
  values
    (new.id, 'contract_nda',    'Upload signed contract and NDA',  1),
    (new.id, 'payment_details', 'Submit payment details',          2),
    (new.id, 'frameio',         'Join the Frame.io workspace',     3),
    (new.id, 'sops',            'Read required SOPs',              4),
    (new.id, 'asset_pack',      'Download the editor asset pack',  5),
    (new.id, 'trial_task',      'Complete first trial task',       6)
  on conflict (editor_id, key) do nothing;
  return new;
end;
$$;

create trigger seed_editor_checklist
  after insert on public.editors
  for each row execute function public.seed_editor_checklist();

-- -----------------------------------------------------------------------------
-- Task invariants
--   * Editors may move their tasks between To Do / In Progress / For Review
--     and update progress, but only an admin can mark Done or request
--     Revisions, or change what the task is.
--   * Entering Revisions bumps revision_count; Done stamps completed_at.
-- -----------------------------------------------------------------------------
create or replace function public.guard_task_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (select auth.uid()) is not null then
    if not public.is_admin() and (
       new.project_id     is distinct from old.project_id
    or new.assignee_id    is distinct from old.assignee_id
    or new.title          is distinct from old.title
    or new.description    is distinct from old.description
    or new.due_date       is distinct from old.due_date
    or new.priority       is distinct from old.priority
    or new.revision_count is distinct from old.revision_count
    or new.is_trial       is distinct from old.is_trial
    or new.idea_id        is distinct from old.idea_id
    ) then
      raise exception 'Editors can only change the status and progress of their tasks.'
        using errcode = '42501';
    end if;

    if not public.is_admin()
       and new.status is distinct from old.status
       and new.status in ('done', 'revisions') then
      raise exception 'Only an admin can move a task to %.', new.status using errcode = '42501';
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

create trigger guard_task_changes
  before insert or update on public.tasks
  for each row execute function public.guard_task_changes();

-- -----------------------------------------------------------------------------
-- Presence
-- Live "online" comes from Realtime Presence; last_seen_at is the durable
-- fallback used for first paint and by server-side alerts.
-- -----------------------------------------------------------------------------
create or replace function public.touch_presence()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_seen_at = now() where id = (select auth.uid());
$$;

revoke execute on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

-- Branding for pages shown before login (login, intake form, application form).
create or replace function public.public_branding()
returns table (company_name text, default_accent text)
language sql
stable
security definer
set search_path = ''
as $$
  select company_name, default_accent from public.app_settings where id = 1;
$$;

grant execute on function public.public_branding() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Dashboard aggregates. Security invoker: RLS applies, so an admin sees the
-- whole team and an editor sees only their own numbers.
-- -----------------------------------------------------------------------------

-- Hours logged per day (open logs count up to now).
create or replace function public.team_hours_by_day(p_from date, p_to date, p_tz text default 'UTC')
returns table (day date, seconds bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    gs::date as day,
    coalesce(sum(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at))), 0)::bigint as seconds
  from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as gs
  left join public.time_logs t
    on (t.started_at at time zone p_tz)::date = gs::date
  group by gs
  order by gs;
$$;

-- Tasks completed per calendar month, for the last p_months months.
create or replace function public.tasks_completed_by_month(p_months integer default 6, p_tz text default 'UTC')
returns table (month date, completed bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    gs::date as month,
    count(t.id) as completed
  from generate_series(
         date_trunc('month', now() at time zone p_tz) - make_interval(months => p_months - 1),
         date_trunc('month', now() at time zone p_tz),
         interval '1 month'
       ) as gs
  left join public.tasks t
    on t.status = 'done'
   and date_trunc('month', t.completed_at at time zone p_tz) = gs
  group by gs
  order by gs;
$$;

-- -----------------------------------------------------------------------------
-- Realtime: tables the UI subscribes to
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.editors,
  public.notifications,
  public.activity_log,
  public.tasks;
