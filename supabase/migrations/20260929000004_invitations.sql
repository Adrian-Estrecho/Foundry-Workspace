-- =============================================================================
-- Foundry · 0010 · Hiring by invitation (Phase 4.5)
--   * The applicant pipeline becomes Applied → Shortlisted → Invited →
--     Joined (or Rejected). The test edit moves out of hiring and into
--     onboarding, so the public test-edit link and its columns are gone.
--   * Inviting someone creates a code (workspace_invitations) that they enter
--     after signing up, from the welcome page or the link in their email.
--     accept_invitation() makes them an editor of that workspace, still
--     onboarding, and hands them the workspace's test edit if it has one.
--   * Wrong codes are throttled per person.
--   * workspace_settings holds admin-only options (the test-edit template).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Applicant stages
-- The stage column is named in two triggers, and its label function takes
-- the old type, so those are dropped and made again around the change.
-- -----------------------------------------------------------------------------
drop trigger touch_applicant_stage on public.applicants;
drop trigger log_applicant_activity on public.applicants;
drop function public.applicant_stage_label(public.applicant_stage);
drop function public.submit_test_edit(uuid, text);

alter type public.applicant_stage rename to applicant_stage_old;
create type public.applicant_stage as enum ('applied', 'shortlisted', 'invited', 'joined', 'rejected');

alter table public.applicants alter column stage drop default;
alter table public.applicants
  alter column stage type public.applicant_stage using (
    case stage::text
      when 'applied' then 'applied'
      when 'rejected' then 'rejected'
      when 'approved' then case when editor_id is not null then 'joined' else 'invited' end
      else 'shortlisted'
    end
  )::public.applicant_stage;
alter table public.applicants alter column stage set default 'applied';
drop type public.applicant_stage_old;

alter table public.applicants drop column test_edit_url, drop column test_submission_url;

create or replace function public.applicant_stage_label(p_stage public.applicant_stage)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'applied'     then 'Applied'
    when 'shortlisted' then 'Shortlisted'
    when 'invited'     then 'Invited'
    when 'joined'      then 'Joined'
    when 'rejected'    then 'Rejected'
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

  elsif new.stage is distinct from old.stage then
    insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, meta)
    values (new.workspace_id, (select auth.uid()), 'applicant.stage_changed', 'applicant', new.id,
            new.full_name || ' moved to ' || public.applicant_stage_label(new.stage),
            jsonb_build_object('from', old.stage, 'to', new.stage));
  end if;
  return null;
end;
$$;

create trigger log_applicant_activity
  after insert or update of stage on public.applicants
  for each row execute function public.log_applicant_activity();

-- Invite state now comes from invitations, not auth accounts.
drop function public.team_accounts();

-- -----------------------------------------------------------------------------
-- Admin-only workspace options
-- -----------------------------------------------------------------------------
create table public.workspace_settings (
  workspace_id    uuid primary key default public.current_workspace_id()
                    references public.workspaces (id) on delete cascade,
  -- The test edit new editors get when they join (none when test_title is
  -- empty: admins assign one from the editor's page instead).
  test_title      text check (char_length(test_title) <= 120),
  test_brief      text check (char_length(test_brief) <= 4000),
  test_asset_url  text check (test_asset_url ~ '^https?://'),
  test_due_days   smallint not null default 3 check (test_due_days between 1 and 30),
  updated_at      timestamptz not null default now()
);

create trigger set_updated_at before update on public.workspace_settings
  for each row execute function public.set_updated_at();
create trigger set_workspace_id before update on public.workspace_settings
  for each row execute function public.set_workspace_id();

alter table public.workspace_settings enable row level security;
create policy "current workspace only" on public.workspace_settings
  as restrictive for all to authenticated
  using (workspace_id = (select public.current_workspace_id()))
  with check (workspace_id = (select public.current_workspace_id()));
create policy "admin full access" on public.workspace_settings
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Invitations
-- -----------------------------------------------------------------------------

-- 12 characters from Crockford's base32 (no I, L, O or U): about 60 bits,
-- shown to people as XXXX-XXXX-XXXX.
create or replace function public.new_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes bytea := extensions.gen_random_bytes(12);
  v_code text := '';
begin
  for i in 0..11 loop
    v_code := v_code || substr(v_alphabet, get_byte(v_bytes, i) % 32 + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- What people type: any case, with or without dashes or spaces, and the
-- usual look-alikes (O for 0, I or L for 1).
create or replace function public.normalize_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'OIL', '011');
$$;

create table public.workspace_invitations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null default public.current_workspace_id()
                  references public.workspaces (id) on delete cascade,
  code          text not null unique default public.new_invite_code() check (code ~ '^[0-9A-Z]{12}$'),
  -- Who it was sent to. The code works for whoever enters it (they may sign
  -- up with another address); the email is for the admin's records.
  email         text,
  full_name     text,
  applicant_id  uuid references public.applicants (id) on delete set null,
  role          public.member_role not null default 'editor' check (role = 'editor'),
  invited_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  expires_at    timestamptz not null default now() + interval '14 days',
  accepted_at   timestamptz,
  accepted_by   uuid references public.profiles (id) on delete set null,
  revoked_at    timestamptz
);
create index workspace_invitations_workspace_idx on public.workspace_invitations (workspace_id, created_at desc);
create index workspace_invitations_applicant_idx on public.workspace_invitations (applicant_id);

create trigger set_workspace_id before update on public.workspace_invitations
  for each row execute function public.set_workspace_id();

alter table public.workspace_invitations enable row level security;
create policy "current workspace only" on public.workspace_invitations
  as restrictive for all to authenticated
  using (workspace_id = (select public.current_workspace_id()))
  with check (workspace_id = (select public.current_workspace_id()));
create policy "admin full access" on public.workspace_invitations
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Wrong codes, for throttling. Only the functions below read or write it.
create table public.invitation_attempts (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  attempted_at  timestamptz not null default now()
);
create index invitation_attempts_user_idx on public.invitation_attempts (user_id, attempted_at desc);
alter table public.invitation_attempts enable row level security;

-- True after 10 wrong codes in 15 minutes.
create or replace function public.invitation_throttled(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.invitation_attempts
          where user_id = p_user_id and attempted_at > now() - interval '15 minutes') >= 10;
$$;

-- What a code would do, before accepting it: which workspace, who invited
-- them, and whether it still works. status is one of valid, member (already
-- in that workspace), expired, revoked, used, not_found, rate_limited.
create or replace function public.preview_invitation(p_code text)
returns table (status text, workspace_name text, invited_by_name text, email text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invitation public.workspace_invitations%rowtype;
begin
  if v_user is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if public.invitation_throttled(v_user) then
    return query select 'rate_limited', null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  select * into v_invitation from public.workspace_invitations
  where code = public.normalize_invite_code(p_code);
  if not found then
    insert into public.invitation_attempts (user_id) values (v_user);
    return query select 'not_found', null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  return query
  select
    case
      when exists (select 1 from public.workspace_members m
                   where m.workspace_id = v_invitation.workspace_id and m.user_id = v_user
                     and m.status in ('onboarding', 'active')) then 'member'
      when v_invitation.revoked_at is not null then 'revoked'
      when v_invitation.accepted_at is not null then 'used'
      when v_invitation.expires_at < now() then 'expired'
      else 'valid'
    end,
    w.name,
    p.full_name,
    v_invitation.email,
    v_invitation.expires_at
  from public.workspaces w
  left join public.profiles p on p.id = v_invitation.invited_by
  where w.id = v_invitation.workspace_id;
end;
$$;

-- Makes someone an editor of a workspace, still onboarding, with an editor
-- record filled in from their application when there is one. Someone who
-- was rejected or left before can come back through a new invitation.
create or replace function public.add_editor_member(p_workspace_id uuid, p_user_id uuid, p_applicant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('foundry.membership_change', 'on', true);

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (p_workspace_id, p_user_id, 'editor', 'onboarding')
  on conflict (workspace_id, user_id) do update
    set status = 'onboarding', role = 'editor', joined_at = now(), approved_at = null, approved_by = null
    where public.workspace_members.status in ('rejected', 'left');

  insert into public.editors (workspace_id, id, applicant_id, software, specialties, hourly_rate, weekly_hours)
  select p_workspace_id, p_user_id,
         case when a.id is not null and not exists (select 1 from public.editors e where e.applicant_id = a.id)
              then a.id end,
         coalesce(a.software, '{}'), coalesce(a.specialties, '{}'), a.hourly_rate, a.weekly_hours
  from (select 1) as one
  left join public.applicants a on a.id = p_applicant_id and a.workspace_id = p_workspace_id
  on conflict (workspace_id, id) do nothing;

  if p_applicant_id is not null then
    update public.applicants
       set editor_id = p_user_id, stage = 'joined'
     where id = p_applicant_id and workspace_id = p_workspace_id;
  end if;

  perform set_config('foundry.membership_change', 'off', true);
end;
$$;

revoke all on function public.add_editor_member(uuid, uuid, uuid) from public, anon, authenticated;

-- Joins the workspace behind a code. Returns 'joined' (with the workspace)
-- or why not: member, expired, revoked, used, not_found, rate_limited.
-- Answers instead of raising, so a wrong code is still recorded.
create or replace function public.accept_invitation(p_code text)
returns table (status text, workspace_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invitation public.workspace_invitations%rowtype;
  v_settings public.workspace_settings%rowtype;
  v_name text;
  v_task_id uuid;
begin
  if v_user is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if public.invitation_throttled(v_user) then
    return query select 'rate_limited', null::uuid;
    return;
  end if;

  select * into v_invitation from public.workspace_invitations
  where code = public.normalize_invite_code(p_code)
  for update;
  if not found then
    insert into public.invitation_attempts (user_id) values (v_user);
    return query select 'not_found', null::uuid;
    return;
  end if;

  if exists (select 1 from public.workspace_members m
             where m.workspace_id = v_invitation.workspace_id and m.user_id = v_user
               and m.status in ('onboarding', 'active')) then
    return query select 'member', v_invitation.workspace_id;
    return;
  end if;
  if v_invitation.revoked_at is not null then
    return query select 'revoked', null::uuid;
    return;
  end if;
  if v_invitation.accepted_at is not null then
    return query select 'used', null::uuid;
    return;
  end if;
  if v_invitation.expires_at < now() then
    return query select 'expired', null::uuid;
    return;
  end if;

  perform public.add_editor_member(v_invitation.workspace_id, v_user, v_invitation.applicant_id);

  update public.workspace_invitations
     set accepted_at = now(), accepted_by = v_user
   where id = v_invitation.id;

  update public.profiles set active_workspace_id = v_invitation.workspace_id where id = v_user;

  -- Their test edit, if the workspace has a template.
  select * into v_settings from public.workspace_settings s where s.workspace_id = v_invitation.workspace_id;
  if nullif(trim(v_settings.test_title), '') is not null
     and not exists (select 1 from public.tasks t
                     where t.workspace_id = v_invitation.workspace_id and t.assignee_id = v_user and t.is_trial) then
    insert into public.tasks (workspace_id, title, description, assignee_id, due_date, is_trial, created_by)
    values (v_invitation.workspace_id, v_settings.test_title, v_settings.test_brief, v_user,
            current_date + v_settings.test_due_days, true, v_invitation.invited_by)
    returning id into v_task_id;

    if v_settings.test_asset_url is not null then
      insert into public.task_attachments (task_id, kind, url, label, added_by)
      values (v_task_id, 'link', v_settings.test_asset_url, 'Footage and assets', v_invitation.invited_by);
    end if;
  end if;

  select full_name into v_name from public.profiles where id = v_user;

  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
  values (v_invitation.workspace_id, v_user, 'editor.joined', 'editor', v_user, v_name || ' joined and started onboarding');

  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  select v_invitation.workspace_id, a.id, 'member_joined', v_name || ' joined your team',
         'They''re onboarding now', '/editors/' || v_user, 'editor', v_user
  from public.workspace_admin_ids(v_invitation.workspace_id) as a(id);

  return query select 'joined', v_invitation.workspace_id;
end;
$$;

revoke all on function public.preview_invitation(text) from public, anon;
grant execute on function public.preview_invitation(text) to authenticated;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
revoke all on function public.invitation_throttled(uuid) from public, anon, authenticated;

-- Memberships change through these functions (joining, approval), which set
-- foundry.membership_change for the rest of their transaction.
create or replace function public.guard_member_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or current_setting('foundry.membership_change', true) = 'on' then
    return new;
  end if;
  if new.workspace_id <> old.workspace_id or new.user_id <> old.user_id then
    raise exception 'Memberships can''t move.' using errcode = '42501';
  end if;
  if (new.role, new.status) is distinct from (old.role, old.status) then
    if new.user_id = (select auth.uid()) then
      raise exception 'You can''t change your own role or access.' using errcode = '42501';
    end if;
    if old.role = 'owner' or new.role = 'owner' then
      raise exception 'The workspace owner can''t be changed here.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Realtime: invitation lists refresh live (accepted, revoked)
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.workspace_invitations;
