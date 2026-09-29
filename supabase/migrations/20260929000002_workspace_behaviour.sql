-- =============================================================================
-- Foundry · 0008 · Workspaces (Phase 4.5): behaviour
--   * New accounts get a profile only. What they can see comes from their
--     workspace memberships (create a workspace, or join one by invitation).
--   * create_workspace / set_active_workspace for the welcome page and the
--     workspace switcher.
--   * Every trigger and function that writes notifications or the activity
--     feed names the workspace, and "tell the admins" means the owners and
--     admins of that workspace.
--   * Public forms (intake, application) and their limits are per workspace,
--     found by slug.
--   * Editor onboarding is per workspace.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Accounts
-- -----------------------------------------------------------------------------

-- New auth user → profile. Sign-up is open, so user_metadata is untrusted:
-- the name is trimmed and capped, and an unknown time zone falls back to UTC.
-- Google sign-ups send "name" and "avatar_url".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(trim(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  )), 120);
  v_tz text := new.raw_user_meta_data ->> 'timezone';
  v_avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  if v_tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    v_tz := 'UTC';
  end if;
  if v_avatar !~ '^https://' then
    v_avatar := null;
  end if;

  insert into public.profiles (id, full_name, email, timezone, avatar_url)
  values (new.id, v_name, new.email, v_tz, v_avatar);
  return new;
end;
$$;

-- Approving an applicant no longer creates an account (they join with an
-- invitation code instead), so the app_metadata link is gone.
drop trigger if exists on_auth_user_app_metadata_changed on auth.users;
drop function if exists public.handle_user_app_metadata();
drop function if exists public.link_editor_to_applicant(uuid, uuid);

-- People edit their own profile. Email only changes through auth (which runs
-- without a signed-in user), and the active workspace can only be one the
-- user still belongs to.
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.email is distinct from old.email then
    raise exception 'You can''t change your email here.' using errcode = '42501';
  end if;

  if new.active_workspace_id is distinct from old.active_workspace_id then
    if new.id <> (select auth.uid()) then
      raise exception 'Only you can switch your workspace.' using errcode = '42501';
    end if;
    if new.active_workspace_id is not null and not exists (
      select 1 from public.workspace_members
      where workspace_id = new.active_workspace_id
        and user_id = new.id
        and status in ('onboarding', 'active')
    ) then
      raise exception 'You''re not a member of that workspace.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Workspaces
-- -----------------------------------------------------------------------------

-- Slugs that would read like part of the app in a public link.
create or replace function public.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_slug = any (array[
    'admin', 'api', 'app', 'apply', 'auth', 'dashboard', 'foundry', 'help', 'intake', 'join',
    'login', 'new', 'settings', 'signup', 'support', 'team', 'thanks', 'welcome', 'www'
  ]);
$$;

-- Creates a workspace owned by the caller and switches them to it. A person
-- can own up to five.
create or replace function public.create_workspace(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := trim(p_name);
  v_slug text := lower(trim(p_slug));
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 60 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' or public.is_reserved_slug(v_slug) then
    raise exception 'invalid_slug' using errcode = 'P0001';
  end if;
  if (select count(*) from public.workspace_members where user_id = v_user and role = 'owner') >= 5 then
    raise exception 'limit_reached' using errcode = 'P0001';
  end if;

  begin
    insert into public.workspaces (name, slug, created_by)
    values (v_name, v_slug, v_user)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'slug_taken' using errcode = 'P0001';
  end;

  insert into public.workspace_members (workspace_id, user_id, role, status, approved_at)
  values (v_id, v_user, 'owner', 'active', now());

  update public.profiles set active_workspace_id = v_id where id = v_user;
  return v_id;
end;
$$;

create or replace function public.set_active_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = (select auth.uid())
      and status in ('onboarding', 'active')
  ) then
    raise exception 'You''re not a member of that workspace.' using errcode = '42501';
  end if;

  update public.profiles
     set active_workspace_id = p_workspace_id
   where id = (select auth.uid())
     and active_workspace_id is distinct from p_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;
revoke all on function public.set_active_workspace(uuid) from public, anon;
grant execute on function public.set_active_workspace(uuid) to authenticated;

-- Branding for public pages (application and intake forms), by slug.
drop function if exists public.public_branding();

create or replace function public.public_branding(p_slug text)
returns table (workspace_id uuid, name text, default_accent text, accepting_applications boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select id, name, default_accent, accepting_applications
  from public.workspaces
  where slug = lower(p_slug);
$$;

grant execute on function public.public_branding(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Access helpers: now scoped to the current workspace, and only for people
-- with full access (a candidate still onboarding only has their trial task)
-- -----------------------------------------------------------------------------
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.is_full_member()) and (
    exists (
      select 1 from public.project_editors
      where project_id = p_project_id
        and editor_id = (select auth.uid())
        and workspace_id = (select public.current_workspace_id())
    ) or exists (
      select 1 from public.tasks
      where project_id = p_project_id
        and assignee_id = (select auth.uid())
        and workspace_id = (select public.current_workspace_id())
    )
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
    where id = p_task_id
      and assignee_id = (select auth.uid())
      and workspace_id = (select public.current_workspace_id())
      and (is_trial or (select public.is_full_member()))
  );
$$;

-- -----------------------------------------------------------------------------
-- Clients: activity and new-lead notifications per workspace
-- -----------------------------------------------------------------------------
create or replace function public.on_client_checklist_ticked()
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
       select 1 from public.client_checklist_items
       where client_id = new.client_id and not is_done
     )
     and not exists (
       select 1 from public.activity_log
       where action = 'client.onboarding_completed' and entity_id = new.client_id
     ) then
    select public.client_display_name(company, contact_name) into v_name
    from public.clients where id = new.client_id;

    insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
    values (new.workspace_id, (select auth.uid()), 'client.onboarding_completed', 'client', new.client_id,
            v_name || ' finished client onboarding');
  end if;
  return null;
end;
$$;

create or replace function public.log_client_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.client_display_name(new.company, new.contact_name);
begin
  if tg_op = 'INSERT' then
    if new.lead_id is not null then
      -- Came through the public intake form.
      insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, meta, created_at)
      values (new.workspace_id, null, 'lead.created', 'client', new.id, 'New lead: ' || v_name,
              jsonb_build_object('project_type', new.project_type, 'budget_range', new.budget_range),
              new.created_at);

      insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id, created_at)
      select new.workspace_id, a.id, 'new_lead', 'New lead: ' || v_name,
             nullif(concat_ws(' · ', new.project_type, new.budget_range), ''),
             '/clients/' || new.id, 'client', new.id, new.created_at
      from public.workspace_admin_ids(new.workspace_id) as a(id);
    else
      insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, created_at)
      values (new.workspace_id, (select auth.uid()), 'client.created', 'client', new.id, 'Client added: ' || v_name,
              new.created_at);
    end if;
  elsif new.stage is distinct from old.stage then
    insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, meta)
    values (new.workspace_id, (select auth.uid()), 'client.stage_changed', 'client', new.id,
            v_name || ' moved to ' || public.client_stage_label(new.stage),
            jsonb_build_object('from', old.stage, 'to', new.stage));
  end if;
  return null;
end;
$$;

create or replace function public.log_project_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, created_at)
  select new.workspace_id, (select auth.uid()), 'project.created', 'project', new.id,
         'New project for ' || public.client_display_name(c.company, c.contact_name) || ': ' || new.name,
         new.created_at
  from public.clients c
  where c.id = new.client_id;
  return null;
end;
$$;

-- Public intake for one workspace. Called only by the server (service role)
-- after spam checks. Limits are per workspace, so one company's spam can't
-- close another's form, plus an overall ceiling.
drop function if exists public.submit_intake(text, text, text, text, text, text, date, text[], text);

create or replace function public.submit_intake(
  p_workspace_id uuid,
  p_name text,
  p_email text,
  p_company text default null,
  p_phone text default null,
  p_project_type text default null,
  p_budget_range text default null,
  p_deadline date default null,
  p_reference_links text[] default '{}',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_client_id uuid;
begin
  if (select count(*) from public.leads
      where workspace_id = p_workspace_id and lower(email) = lower(p_email)
        and created_at > now() - interval '10 minutes') >= 3
  or (select count(*) from public.leads
      where workspace_id = p_workspace_id and created_at > now() - interval '10 minutes') >= 30
  or (select count(*) from public.leads where created_at > now() - interval '10 minutes') >= 300 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.leads (workspace_id, name, company, email, phone, project_type, budget_range, deadline, reference_links, notes)
  values (p_workspace_id, p_name, p_company, lower(p_email), p_phone, p_project_type, p_budget_range, p_deadline,
          coalesce(p_reference_links, '{}'), p_notes)
  returning id into v_lead_id;

  -- New leads go to the top of their column. (The client takes its
  -- workspace from the lead.)
  insert into public.clients (lead_id, contact_name, company, email, phone, project_type, budget_range, deadline, position)
  values (v_lead_id, p_name, p_company, lower(p_email), p_phone, p_project_type, p_budget_range, p_deadline,
          coalesce((select min(position) from public.clients
                    where workspace_id = p_workspace_id and stage = 'new_lead'), 1) - 1)
  returning id into v_client_id;

  return v_client_id;
end;
$$;

revoke all on function public.submit_intake(uuid, text, text, text, text, text, text, date, text[], text)
  from public, anon, authenticated;
grant execute on function public.submit_intake(uuid, text, text, text, text, text, text, date, text[], text)
  to service_role;

-- -----------------------------------------------------------------------------
-- Applicants
-- -----------------------------------------------------------------------------
create or replace function public.log_applicant_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, meta, created_at)
    values (new.workspace_id, (select auth.uid()), 'applicant.created', 'applicant', new.id,
            'New applicant: ' || new.full_name,
            jsonb_build_object('software', new.software, 'specialties', new.specialties),
            new.created_at);

    insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id, created_at)
    select new.workspace_id, a.id, 'new_applicant', 'New applicant: ' || new.full_name,
           nullif(concat_ws(' · ',
             nullif(array_to_string(new.software[1:2], ', '), ''),
             nullif(array_to_string(new.specialties[1:2], ', '), '')), ''),
           '/editors/applicants/' || new.id, 'applicant', new.id, new.created_at
    from public.workspace_admin_ids(new.workspace_id) as a(id);

  -- Sent by the applicant through their test-edit link (no signed-in user).
  elsif new.test_submission_url is distinct from old.test_submission_url
        and new.test_submission_url is not null
        and (select auth.uid()) is null then
    insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
    values (new.workspace_id, null, 'applicant.test_submitted', 'applicant', new.id,
            new.full_name || ' submitted their test edit');

    insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
    select new.workspace_id, a.id, 'new_applicant', 'Test edit submitted: ' || new.full_name,
           'Ready for you to review', '/editors/applicants/' || new.id, 'applicant', new.id
    from public.workspace_admin_ids(new.workspace_id) as a(id);

  elsif new.stage is distinct from old.stage then
    insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, meta)
    values (new.workspace_id, (select auth.uid()), 'applicant.stage_changed', 'applicant', new.id,
            new.full_name || ' moved to ' || public.applicant_stage_label(new.stage),
            jsonb_build_object('from', old.stage, 'to', new.stage));
  end if;
  return null;
end;
$$;

-- Public application form for one workspace. Called only by the server
-- (service role) after spam checks. One application per email per workspace
-- every 30 days, per-workspace and overall rate limits, and nothing while the
-- workspace isn't hiring.
drop function if exists public.submit_application(text, text, text, text[], text[], text, numeric, integer, text);

create or replace function public.submit_application(
  p_workspace_id uuid,
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
  if not exists (select 1 from public.workspaces where id = p_workspace_id and accepting_applications) then
    raise exception 'closed' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.applicants
    where workspace_id = p_workspace_id
      and lower(email) = lower(p_email)
      and created_at > now() - interval '30 days'
  ) then
    raise exception 'duplicate' using errcode = 'P0001';
  end if;
  if (select count(*) from public.applicants
      where workspace_id = p_workspace_id and created_at > now() - interval '10 minutes') >= 30
  or (select count(*) from public.applicants where created_at > now() - interval '10 minutes') >= 300 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- New applicants go to the top of Applied.
  insert into public.applicants (
    workspace_id, full_name, email, portfolio_url, software, specialties, timezone, hourly_rate,
    weekly_hours, availability_notes, position
  )
  values (
    p_workspace_id, p_full_name, lower(p_email), p_portfolio_url, coalesce(p_software, '{}'),
    coalesce(p_specialties, '{}'), p_timezone, p_hourly_rate, p_weekly_hours, p_availability_notes,
    coalesce((select min(position) from public.applicants
              where workspace_id = p_workspace_id and stage = 'applied'), 1) - 1
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_application(uuid, text, text, text, text[], text[], text, numeric, integer, text)
  from public, anon, authenticated;
grant execute on function public.submit_application(uuid, text, text, text, text[], text[], text, numeric, integer, text)
  to service_role;

-- The applicant's test edit, sent from the signed link in their test-edit
-- email. (Replaced by the onboarding test edit in 0010.)
create or replace function public.submit_test_edit(p_applicant_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_applicant public.applicants%rowtype;
begin
  select * into v_applicant from public.applicants where id = p_applicant_id for update;
  if not found or v_applicant.stage not in ('test_edit_sent', 'test_submitted') then
    raise exception 'closed' using errcode = 'P0001';
  end if;

  update public.applicants
     set test_submission_url = p_url,
         stage = 'test_submitted',
         position = case
           when v_applicant.stage = 'test_submitted' then position
           else coalesce((select max(position) from public.applicants
                          where workspace_id = v_applicant.workspace_id and stage = 'test_submitted'), 0) + 1
         end
   where id = p_applicant_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Editor onboarding, per workspace
-- -----------------------------------------------------------------------------

-- Ticks the steps Foundry can check for itself. Only ever ticks: an admin can
-- still untick by hand. "Read required SOPs" counts the workspace's SOPs and
-- is done when there are none left to read.
drop function if exists public.sync_editor_checklist(uuid);

create or replace function public.sync_editor_checklist(p_workspace_id uuid, p_editor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keys text[] := '{}';
begin
  if exists (select 1 from public.editor_documents
             where workspace_id = p_workspace_id and editor_id = p_editor_id and doc_type = 'contract')
     and exists (select 1 from public.editor_documents
                 where workspace_id = p_workspace_id and editor_id = p_editor_id and doc_type = 'nda') then
    v_keys := array_append(v_keys, 'contract_nda');
  end if;
  if exists (select 1 from public.editor_payment_details
             where workspace_id = p_workspace_id and editor_id = p_editor_id) then
    v_keys := array_append(v_keys, 'payment_details');
  end if;
  if not exists (
    select 1 from public.sops s
    where s.workspace_id = p_workspace_id
      and s.is_required and s.is_published
      and not exists (
        select 1 from public.sop_acknowledgments a
        where a.sop_id = s.id and a.editor_id = p_editor_id
      )
  ) then
    v_keys := array_append(v_keys, 'sops');
  end if;
  if exists (
    select 1 from public.tasks
    where workspace_id = p_workspace_id and assignee_id = p_editor_id and is_trial and status = 'done'
  ) then
    v_keys := array_append(v_keys, 'trial_task');
  end if;

  update public.editor_checklist_items
     set is_done = true, done_at = now()
   where workspace_id = p_workspace_id
     and editor_id = p_editor_id
     and key = any (v_keys)
     and not is_done;
end;
$$;

revoke all on function public.sync_editor_checklist(uuid, uuid) from public, anon, authenticated;

-- New editors get their checklist, with anything already true ticked.
create or replace function public.seed_editor_checklist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.editor_checklist_items (workspace_id, editor_id, key, label, position)
  values
    (new.workspace_id, new.id, 'contract_nda',    'Upload signed contract and NDA',  1),
    (new.workspace_id, new.id, 'payment_details', 'Submit payment details',          2),
    (new.workspace_id, new.id, 'frameio',         'Join the Frame.io workspace',     3),
    (new.workspace_id, new.id, 'sops',            'Read required SOPs',              4),
    (new.workspace_id, new.id, 'asset_pack',      'Download the editor asset pack',  5),
    (new.workspace_id, new.id, 'trial_task',      'Pass the test edit',              6)
  on conflict (workspace_id, editor_id, key) do nothing;
  perform public.sync_editor_checklist(new.workspace_id, new.id);
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
  perform public.sync_editor_checklist(new.workspace_id, new.editor_id);
  return null;
end;
$$;

create or replace function public.on_trial_task_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_editor_checklist(new.workspace_id, new.assignee_id);
  return null;
end;
$$;

-- The last step ticked: stamp the editor, log it and tell the workspace's
-- admins. Runs once per editor, even if a step is later unticked and ticked
-- again. (0011 turns this into "ready for final approval".)
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
       where workspace_id = new.workspace_id and editor_id = new.editor_id and not is_done
     ) then
    update public.editors
       set onboarding_completed_at = now()
     where workspace_id = new.workspace_id and id = new.editor_id and onboarding_completed_at is null;

    if found then
      select full_name into v_name from public.profiles where id = new.editor_id;

      insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
      values (new.workspace_id, (select auth.uid()), 'editor.onboarded', 'editor', new.editor_id,
              v_name || ' finished onboarding');

      insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
      select new.workspace_id, a.id, 'editor_onboarded', v_name || ' finished onboarding',
             'Ready for their first project', '/editors/' || new.editor_id, 'editor', new.editor_id
      from public.workspace_admin_ids(new.workspace_id) as a(id);
    end if;
  end if;
  return null;
end;
$$;

-- Self-reported steps, in the editor's current workspace only.
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
   where workspace_id = (select public.current_workspace_id())
     and editor_id = (select auth.uid())
     and key = p_key
     and is_done is distinct from p_done;
end;
$$;

-- Invite and sign-in state of the current workspace's members, for its
-- admins. (Gone in 0010, when invitations replace account invites.)
create or replace function public.team_accounts()
returns table (id uuid, invited_at timestamptz, confirmed_at timestamptz, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.invited_at, u.email_confirmed_at, u.last_sign_in_at
  from auth.users u
  join public.workspace_members m on m.user_id = u.id
  where m.workspace_id = (select public.current_workspace_id())
    and (select public.is_admin());
$$;

-- -----------------------------------------------------------------------------
-- Tasks & projects
-- -----------------------------------------------------------------------------
create or replace function public.notify_task_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
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
    end if;
  end if;

  return null;
end;
$$;

-- @mentions notify only people who can open the task: the workspace's admins
-- and the assignee. (The mentions array comes from the client, so it is
-- matched against the task's own workspace.)
create or replace function public.notify_task_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_author text;
begin
  if cardinality(new.mentions) = 0 then
    return null;
  end if;
  select * into v_task from public.tasks where id = new.task_id;
  select full_name into v_author from public.profiles where id = new.author_id;

  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  select v_task.workspace_id, m.user_id, 'mention',
         v_author || ' mentioned you on ' || v_task.title,
         left(new.body, 160),
         case
           when not v_task.is_trial then '/tasks/' || v_task.id
           when m.role in ('owner', 'admin') then '/editors/' || v_task.assignee_id
           else '/onboarding'
         end,
         'task', v_task.id
  from public.workspace_members m
  where m.workspace_id = v_task.workspace_id
    and m.user_id = any (new.mentions)
    and m.user_id <> new.author_id
    and m.status in ('onboarding', 'active')
    and ((m.role in ('owner', 'admin') and m.status = 'active') or m.user_id = v_task.assignee_id);

  return null;
end;
$$;

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

  if new.status is distinct from old.status then
    insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, meta)
    values (new.workspace_id, v_actor, 'task.status_changed', 'task', new.id,
            case when v_actor_name is null then new.title || ' moved to '
                 else v_actor_name || ' moved ' || new.title || ' to ' end
            || public.task_status_label(new.status),
            jsonb_build_object('from', old.status, 'to', new.status));
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

create or replace function public.log_project_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, meta)
  values (new.workspace_id, (select auth.uid()), 'project.status_changed', 'project', new.id,
          new.name || ' moved to ' || public.project_status_label(new.status),
          jsonb_build_object('from', old.status, 'to', new.status));
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Realtime: membership changes (approval, a new joiner) refresh live
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.workspace_members;
