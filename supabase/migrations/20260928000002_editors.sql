-- =============================================================================
-- Foundry · 0005 · Editors (Phase 3)
--   * Public application → applicant card, atomically and rate limited
--   * Test edits come back through a signed link (submit_test_edit)
--   * Applicant stage bookkeeping, activity feed, admin notifications
--   * Editor onboarding: steps tick themselves from uploads, payment details,
--     SOP acknowledgments and the trial task. Editors tick only the steps
--     Foundry can't check (Frame.io, asset pack), through set_onboarding_step()
--   * Finishing onboarding stamps the editor and notifies admins
--   * Trial task hand-offs notify the other side
--   * Account status and hours per editor for the roster
-- =============================================================================

-- Where editors download the contract and NDA they sign during onboarding.
alter table public.app_settings add column contract_template_url text;

-- -----------------------------------------------------------------------------
-- Applicants
-- -----------------------------------------------------------------------------
create or replace function public.applicant_stage_label(p_stage public.applicant_stage)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'applied'        then 'Applied'
    when 'test_edit_sent' then 'Test Edit Sent'
    when 'test_submitted' then 'Test Submitted'
    when 'interview'      then 'Interview'
    when 'approved'       then 'Approved'
    when 'rejected'       then 'Rejected'
  end;
$$;

create or replace function public.touch_applicant_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger touch_applicant_stage
  before update of stage on public.applicants
  for each row execute function public.touch_applicant_stage();

create or replace function public.log_applicant_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (actor_id, action, entity_type, entity_id, summary, meta, created_at)
    values ((select auth.uid()), 'applicant.created', 'applicant', new.id, 'New applicant: ' || new.full_name,
            jsonb_build_object('software', new.software, 'specialties', new.specialties),
            new.created_at);

    insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id, created_at)
    select p.id, 'new_applicant', 'New applicant: ' || new.full_name,
           nullif(concat_ws(' · ',
             nullif(array_to_string(new.software[1:2], ', '), ''),
             nullif(array_to_string(new.specialties[1:2], ', '), '')), ''),
           '/editors/applicants/' || new.id, 'applicant', new.id, new.created_at
    from public.profiles p
    where p.role = 'admin';

  -- Sent by the applicant through their test-edit link (no signed-in user).
  elsif new.test_submission_url is distinct from old.test_submission_url
        and new.test_submission_url is not null
        and (select auth.uid()) is null then
    insert into public.activity_log (actor_id, action, entity_type, entity_id, summary)
    values (null, 'applicant.test_submitted', 'applicant', new.id, new.full_name || ' submitted their test edit');

    insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
    select p.id, 'new_applicant', 'Test edit submitted: ' || new.full_name, 'Ready for you to review',
           '/editors/applicants/' || new.id, 'applicant', new.id
    from public.profiles p
    where p.role = 'admin';

  elsif new.stage is distinct from old.stage then
    insert into public.activity_log (actor_id, action, entity_type, entity_id, summary, meta)
    values ((select auth.uid()), 'applicant.stage_changed', 'applicant', new.id,
            new.full_name || ' moved to ' || public.applicant_stage_label(new.stage),
            jsonb_build_object('from', old.stage, 'to', new.stage));
  end if;
  return null;
end;
$$;

create trigger log_applicant_activity
  after insert or update of stage, test_submission_url on public.applicants
  for each row execute function public.log_applicant_activity();

-- Public application form. Called only by the server (service role) after
-- spam checks. One application per email every 30 days, plus an overall
-- rate limit as a last line of defence.
create or replace function public.submit_application(
  p_full_name text,
  p_email text,
  p_portfolio_url text default null,
  p_software text[] default '{}',
  p_specialties text[] default '{}',
  p_timezone text default null,
  p_hourly_rate numeric default null,
  p_weekly_hours integer default null,
  p_availability_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if exists (
    select 1 from public.applicants
    where lower(email) = lower(p_email) and created_at > now() - interval '30 days'
  ) then
    raise exception 'duplicate' using errcode = 'P0001';
  end if;
  if (select count(*) from public.applicants where created_at > now() - interval '10 minutes') >= 50 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- New applicants go to the top of Applied.
  insert into public.applicants (
    full_name, email, portfolio_url, software, specialties, timezone, hourly_rate, weekly_hours,
    availability_notes, position
  )
  values (
    p_full_name, lower(p_email), p_portfolio_url, coalesce(p_software, '{}'), coalesce(p_specialties, '{}'),
    p_timezone, p_hourly_rate, p_weekly_hours, p_availability_notes,
    coalesce((select min(position) from public.applicants where stage = 'applied'), 1) - 1
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- The applicant's test edit, sent from the signed link in their test-edit
-- email. Works while a test is out or already submitted (to send a new link).
create or replace function public.submit_test_edit(p_applicant_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage public.applicant_stage;
begin
  select stage into v_stage from public.applicants where id = p_applicant_id for update;
  if not found or v_stage not in ('test_edit_sent', 'test_submitted') then
    raise exception 'closed' using errcode = 'P0001';
  end if;

  update public.applicants
     set test_submission_url = p_url,
         stage = 'test_submitted',
         position = case
           when v_stage = 'test_submitted' then position
           else coalesce((select max(position) from public.applicants where stage = 'test_submitted'), 0) + 1
         end
   where id = p_applicant_id;
end;
$$;

-- Approving an applicant creates their account with `applicant_id` in
-- app_metadata. Supabase Auth writes app_metadata in an update right after
-- inserting the user, so handle_new_user (on insert) doesn't see it: link
-- the editor to their application here instead, filling in their skills,
-- rate and hours. Only ever fills an editor that isn't linked yet.
create or replace function public.link_editor_to_applicant(p_editor_id uuid, p_applicant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.editors e
     set applicant_id = a.id,
         software = a.software,
         specialties = a.specialties,
         hourly_rate = a.hourly_rate,
         weekly_hours = a.weekly_hours
    from public.applicants a
   where e.id = p_editor_id
     and a.id = p_applicant_id
     and e.applicant_id is null
     and not exists (select 1 from public.editors other where other.applicant_id = p_applicant_id);

  if found then
    update public.applicants set editor_id = p_editor_id where id = p_applicant_id;
  end if;
end;
$$;

create or replace function public.handle_user_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_applicant_id uuid := public.try_uuid(new.raw_app_meta_data ->> 'applicant_id');
begin
  if v_applicant_id is not null then
    perform public.link_editor_to_applicant(new.id, v_applicant_id);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_app_metadata_changed
  after update of raw_app_meta_data on auth.users
  for each row
  when (new.raw_app_meta_data ->> 'applicant_id' is distinct from old.raw_app_meta_data ->> 'applicant_id')
  execute function public.handle_user_app_metadata();

revoke all on function public.link_editor_to_applicant(uuid, uuid) from public, anon, authenticated;

revoke all on function public.submit_application(text, text, text, text[], text[], text, numeric, integer, text)
  from public, anon, authenticated;
grant execute on function public.submit_application(text, text, text, text[], text[], text, numeric, integer, text)
  to service_role;
revoke all on function public.submit_test_edit(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_test_edit(uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- Editor onboarding
-- -----------------------------------------------------------------------------

-- Ticks the steps Foundry can check for itself. Only ever ticks: an admin can
-- still untick by hand. "Read required SOPs" counts as done when there are
-- none left to read.
create or replace function public.sync_editor_checklist(p_editor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keys text[] := '{}';
begin
  if exists (select 1 from public.editor_documents where editor_id = p_editor_id and doc_type = 'contract')
     and exists (select 1 from public.editor_documents where editor_id = p_editor_id and doc_type = 'nda') then
    v_keys := array_append(v_keys, 'contract_nda');
  end if;
  if exists (select 1 from public.editor_payment_details where editor_id = p_editor_id) then
    v_keys := array_append(v_keys, 'payment_details');
  end if;
  if not exists (
    select 1 from public.sops s
    where s.is_required and s.is_published
      and not exists (
        select 1 from public.sop_acknowledgments a
        where a.sop_id = s.id and a.editor_id = p_editor_id
      )
  ) then
    v_keys := array_append(v_keys, 'sops');
  end if;
  if exists (
    select 1 from public.tasks
    where assignee_id = p_editor_id and is_trial and status = 'done'
  ) then
    v_keys := array_append(v_keys, 'trial_task');
  end if;

  update public.editor_checklist_items
     set is_done = true, done_at = now()
   where editor_id = p_editor_id
     and key = any (v_keys)
     and not is_done;
end;
$$;

-- New editors get their checklist, with anything already true ticked.
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
  perform public.sync_editor_checklist(new.id);
  return new;
end;
$$;

create or replace function public.on_editor_onboarding_input()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_editor_checklist(new.editor_id);
  return null;
end;
$$;

create trigger sync_checklist_on_document
  after insert on public.editor_documents
  for each row execute function public.on_editor_onboarding_input();

create trigger sync_checklist_on_payment_details
  after insert or update on public.editor_payment_details
  for each row execute function public.on_editor_onboarding_input();

create trigger sync_checklist_on_sop_ack
  after insert on public.sop_acknowledgments
  for each row execute function public.on_editor_onboarding_input();

create or replace function public.on_trial_task_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_editor_checklist(new.assignee_id);
  return null;
end;
$$;

create trigger on_trial_task_done
  after insert or update of status on public.tasks
  for each row
  when (new.is_trial and new.status = 'done' and new.assignee_id is not null)
  execute function public.on_trial_task_done();

-- The last step ticked: stamp the editor, log it and tell the admins. Runs
-- once per editor, even if a step is later unticked and ticked again.
create or replace function public.on_editor_checklist_ticked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if new.is_done and not old.is_done
     and not exists (
       select 1 from public.editor_checklist_items
       where editor_id = new.editor_id and not is_done
     ) then
    update public.editors
       set onboarding_completed_at = now()
     where id = new.editor_id and onboarding_completed_at is null;

    if found then
      select full_name into v_name from public.profiles where id = new.editor_id;

      insert into public.activity_log (actor_id, action, entity_type, entity_id, summary)
      values ((select auth.uid()), 'editor.onboarded', 'editor', new.editor_id, v_name || ' finished onboarding');

      insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
      select p.id, 'editor_onboarded', v_name || ' finished onboarding', 'Ready for their first project',
             '/editors/' || new.editor_id, 'editor', new.editor_id
      from public.profiles p
      where p.role = 'admin';
    end if;
  end if;
  return null;
end;
$$;

create trigger on_editor_checklist_ticked
  after update of is_done on public.editor_checklist_items
  for each row execute function public.on_editor_checklist_ticked();

-- Editors no longer update checklist rows directly: the checked steps tick
-- themselves, and the self-reported ones go through this function.
drop policy "editors tick own checklist" on public.editor_checklist_items;

create or replace function public.set_onboarding_step(p_key text, p_done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key not in ('frameio', 'asset_pack') then
    raise exception 'This step completes itself.' using errcode = '42501';
  end if;

  update public.editor_checklist_items
     set is_done = p_done, done_at = case when p_done then now() end
   where editor_id = (select auth.uid())
     and key = p_key
     and is_done is distinct from p_done;
end;
$$;

revoke all on function public.set_onboarding_step(text, boolean) from public, anon;
grant execute on function public.set_onboarding_step(text, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Trial tasks: tell the other side when it's their turn. (The Tasks module
-- in Phase 4 widens this to every task.)
-- -----------------------------------------------------------------------------
create or replace function public.notify_trial_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  select full_name into v_name from public.profiles where id = new.assignee_id;

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id, created_at)
    values (new.assignee_id, 'task_assigned', 'Your trial task: ' || new.title,
            case when new.due_date is not null then 'Due ' || to_char(new.due_date, 'Mon FMDD') end,
            '/onboarding', 'task', new.id, new.created_at);
  elsif new.status = 'for_review' then
    insert into public.activity_log (actor_id, action, entity_type, entity_id, summary)
    values ((select auth.uid()), 'task.status_changed', 'task', new.id,
            v_name || ' moved ' || new.title || ' to For Review');

    insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
    select p.id, 'task_for_review', 'Trial task ready: ' || v_name, new.title,
           '/editors/' || new.assignee_id, 'task', new.id
    from public.profiles p
    where p.role = 'admin';
  elsif new.status = 'revisions' then
    insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
    values (new.assignee_id, 'revision_requested', 'Revisions requested: ' || new.title,
            'See the feedback on your onboarding page', '/onboarding', 'task', new.id);
  end if;
  return null;
end;
$$;

create trigger notify_trial_task
  after insert or update of status on public.tasks
  for each row
  when (new.is_trial and new.assignee_id is not null)
  execute function public.notify_trial_task();

-- -----------------------------------------------------------------------------
-- Roster helpers
-- -----------------------------------------------------------------------------

-- Invite and sign-in state of every account, for admins only.
create or replace function public.team_accounts()
returns table (id uuid, invited_at timestamptz, confirmed_at timestamptz, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.invited_at, u.email_confirmed_at, u.last_sign_in_at
  from auth.users u
  where (select public.is_admin());
$$;

revoke all on function public.team_accounts() from public, anon;
grant execute on function public.team_accounts() to authenticated;

-- Hours logged per editor between two dates (by the day each log started,
-- like team_hours_by_day). Security invoker: RLS applies.
create or replace function public.editor_hours(p_from date, p_to date, p_tz text default 'UTC')
returns table (editor_id uuid, seconds bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.editor_id,
    coalesce(sum(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at))), 0)::bigint as seconds
  from public.time_logs t
  where (t.started_at at time zone p_tz)::date between p_from and p_to
  group by t.editor_id;
$$;

-- Internal helpers are not part of the API.
revoke all on function public.sync_editor_checklist(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: the applicant board and onboarding progress refresh live
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.applicants,
  public.editor_checklist_items,
  public.editor_documents;
