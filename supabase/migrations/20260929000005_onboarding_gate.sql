-- =============================================================================
-- Foundry · 0011 · Onboarding with limited access (Phase 4.5)
--   * An editor who joined by invitation is "onboarding" until an admin
--     approves them. Until then they only reach their own onboarding data:
--     editor record, documents, payment details, checklist, SOPs, their test
--     edit (trial task) and their interview. Everything else (clients,
--     projects, other tasks, attendance, announcements, …) needs full access.
--   * Only approved editors can be given real work.
--   * Interviews: admins schedule one (date, time, meeting link), the editor
--     sees it, and marking it passed ticks the new "interview" step.
--   * Private notes on editors, for admins only.
--   * Finishing every step tells the admins the editor is ready for final
--     approval. approve_member() gives full access; reject_member() ends it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Full access only
-- -----------------------------------------------------------------------------

-- The caller's own test edit, in their current workspace.
create or replace function public.is_own_trial_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks
    where id = p_task_id
      and is_trial
      and assignee_id = (select auth.uid())
      and workspace_id = (select public.current_workspace_id())
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'leads', 'clients', 'client_checklist_items', 'applicants', 'projects', 'project_editors',
    'shifts', 'time_logs', 'status_events', 'shift_reports', 'meetings', 'meeting_rsvps',
    'announcements', 'announcement_comments', 'announcement_reactions', 'ideas', 'activity_log'
  ] loop
    execute format(
      'create policy "full access only" on public.%I
         as restrictive for all to authenticated
         using ((select public.is_full_member()))
         with check ((select public.is_full_member()))', t);
  end loop;
end;
$$;

create policy "full access or own test edit" on public.tasks
  as restrictive for all to authenticated
  using ((select public.is_full_member()) or (is_trial and assignee_id = (select auth.uid())))
  with check ((select public.is_full_member()) or (is_trial and assignee_id = (select auth.uid())));

do $$
declare
  t text;
begin
  foreach t in array array['subtasks', 'task_attachments', 'task_comments'] loop
    execute format(
      'create policy "full access or own test edit" on public.%I
         as restrictive for all to authenticated
         using ((select public.is_full_member()) or public.is_own_trial_task(task_id))
         with check ((select public.is_full_member()) or public.is_own_trial_task(task_id))', t);
  end loop;
end;
$$;

-- Real work only goes to approved editors; a test edit to anyone in the
-- workspace who is onboarding or active.
create or replace function public.guard_task_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.member_status;
  v_name text;
begin
  if new.assignee_id is null then
    return new;
  end if;
  select m.status into v_status from public.workspace_members m
  where m.workspace_id = new.workspace_id and m.user_id = new.assignee_id;

  if v_status is null or v_status not in ('onboarding', 'active') then
    raise exception 'That editor is no longer in this workspace.' using errcode = '23514';
  end if;
  if v_status = 'onboarding' and not new.is_trial then
    select full_name into v_name from public.profiles where id = new.assignee_id;
    raise exception '% is still onboarding. Give them work once you''ve approved them.', v_name
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Named to run after set_workspace_id (BEFORE triggers fire in name order),
-- which gives a task on a project its workspace.
create trigger validate_task_assignee
  before insert or update of assignee_id, is_trial on public.tasks
  for each row execute function public.guard_task_assignee();

-- -----------------------------------------------------------------------------
-- Interviews
-- -----------------------------------------------------------------------------
create type public.interview_outcome as enum ('scheduled', 'passed', 'failed', 'cancelled');

create table public.editor_interviews (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null default public.current_workspace_id()
                      references public.workspaces (id) on delete cascade,
  editor_id         uuid not null,
  scheduled_at      timestamptz not null,
  duration_minutes  integer not null default 30 check (duration_minutes between 5 and 240),
  meeting_url       text check (meeting_url ~ '^https?://'),
  note_to_editor    text check (char_length(note_to_editor) <= 2000),
  outcome           public.interview_outcome not null default 'scheduled',
  decided_at        timestamptz,
  created_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (workspace_id, editor_id) references public.editors (workspace_id, id) on delete cascade
);
create index editor_interviews_editor_idx on public.editor_interviews (workspace_id, editor_id, scheduled_at desc);

create trigger set_updated_at before update on public.editor_interviews
  for each row execute function public.set_updated_at();
create trigger set_workspace_id before update on public.editor_interviews
  for each row execute function public.set_workspace_id();

alter table public.editor_interviews enable row level security;
create policy "current workspace only" on public.editor_interviews
  as restrictive for all to authenticated
  using (workspace_id = (select public.current_workspace_id()))
  with check (workspace_id = (select public.current_workspace_id()));
create policy "admin full access" on public.editor_interviews
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "editors read own interviews" on public.editor_interviews
  for select to authenticated using (editor_id = (select auth.uid()));

-- Tell the editor when it's booked or moved, and keep the checklist in step.
create or replace function public.on_interview_saved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_when text;
begin
  if new.outcome = 'scheduled'
     and (tg_op = 'INSERT' or new.scheduled_at is distinct from old.scheduled_at or old.outcome <> 'scheduled') then
    select timezone into v_tz from public.profiles where id = new.editor_id;
    v_when := to_char(new.scheduled_at at time zone coalesce(v_tz, 'UTC'), 'Dy Mon FMDD, FMHH12:MI AM');

    insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
    values (new.workspace_id, new.editor_id, 'interview_scheduled',
            case when tg_op = 'INSERT' or old.outcome <> 'scheduled' then 'Interview booked: ' else 'Interview moved: ' end || v_when,
            'Details and the meeting link are on your onboarding page', '/onboarding', 'interview', new.id);
  end if;

  if tg_op = 'UPDATE' and new.outcome is distinct from old.outcome and new.outcome in ('passed', 'failed') then
    insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
    select new.workspace_id, (select auth.uid()), 'editor.interview_' || new.outcome, 'editor', new.editor_id,
           p.full_name || case when new.outcome = 'passed' then ' passed' else ' didn''t pass' end || ' their interview'
    from public.profiles p where p.id = new.editor_id;
  end if;

  perform public.sync_editor_checklist(new.workspace_id, new.editor_id);
  return null;
end;
$$;

create trigger on_interview_saved
  after insert or update of scheduled_at, outcome on public.editor_interviews
  for each row execute function public.on_interview_saved();

-- -----------------------------------------------------------------------------
-- Private notes on editors (admins only)
-- -----------------------------------------------------------------------------
create table public.editor_notes (
  workspace_id  uuid not null default public.current_workspace_id()
                  references public.workspaces (id) on delete cascade,
  editor_id     uuid not null,
  body          text not null default '' check (char_length(body) <= 8000),
  updated_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, editor_id),
  foreign key (workspace_id, editor_id) references public.editors (workspace_id, id) on delete cascade
);

create trigger set_updated_at before update on public.editor_notes
  for each row execute function public.set_updated_at();
create trigger set_workspace_id before update on public.editor_notes
  for each row execute function public.set_workspace_id();

alter table public.editor_notes enable row level security;
create policy "current workspace only" on public.editor_notes
  as restrictive for all to authenticated
  using (workspace_id = (select public.current_workspace_id()))
  with check (workspace_id = (select public.current_workspace_id()));
create policy "admin full access" on public.editor_notes
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- The interview step
-- -----------------------------------------------------------------------------
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
  if exists (
    select 1 from public.editor_interviews
    where workspace_id = p_workspace_id and editor_id = p_editor_id and outcome = 'passed'
  ) then
    v_keys := array_append(v_keys, 'interview');
  end if;

  update public.editor_checklist_items
     set is_done = true, done_at = now()
   where workspace_id = p_workspace_id
     and editor_id = p_editor_id
     and key = any (v_keys)
     and not is_done;
end;
$$;

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
    (new.workspace_id, new.id, 'trial_task',      'Pass the test edit',              6),
    (new.workspace_id, new.id, 'interview',       'Pass the interview',              7)
  on conflict (workspace_id, editor_id, key) do nothing;
  perform public.sync_editor_checklist(new.workspace_id, new.id);
  return new;
end;
$$;

-- Editors already approved don't need one.
insert into public.editor_checklist_items (workspace_id, editor_id, key, label, position, is_done, done_at)
select e.workspace_id, e.id, 'interview', 'Pass the interview', 7,
       m.status = 'active', case when m.status = 'active' then coalesce(e.onboarding_completed_at, now()) end
from public.editors e
join public.workspace_members m on m.workspace_id = e.workspace_id and m.user_id = e.id
on conflict (workspace_id, editor_id, key) do nothing;

-- Every step done: the admins decide. Runs once per editor, and only for
-- editors still waiting for approval.
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

    if found and exists (
      select 1 from public.workspace_members
      where workspace_id = new.workspace_id and user_id = new.editor_id and status = 'onboarding'
    ) then
      select full_name into v_name from public.profiles where id = new.editor_id;

      insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
      values (new.workspace_id, (select auth.uid()), 'editor.onboarding_ready', 'editor', new.editor_id,
              v_name || ' finished every onboarding step');

      insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
      select new.workspace_id, a.id, 'onboarding_ready', v_name || ' is ready for your approval',
             'Every onboarding step is done', '/editors/' || new.editor_id, 'editor', new.editor_id
      from public.workspace_admin_ids(new.workspace_id) as a(id);
    end if;
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Final decision
-- -----------------------------------------------------------------------------

-- Gives an onboarding editor full access to the current workspace.
create or replace function public.approve_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (select public.current_workspace_id());
  v_workspace text;
  v_name text;
begin
  if not public.is_admin_of(v_workspace_id) then
    raise exception 'Only an admin can approve editors.' using errcode = '42501';
  end if;
  perform set_config('foundry.membership_change', 'on', true);

  update public.workspace_members
     set status = 'active', approved_at = now(), approved_by = (select auth.uid())
   where workspace_id = v_workspace_id and user_id = p_user_id and role = 'editor' and status = 'onboarding';
  if not found then
    raise exception 'not_onboarding' using errcode = 'P0001';
  end if;

  update public.editors
     set onboarding_completed_at = coalesce(onboarding_completed_at, now()), is_active = true
   where workspace_id = v_workspace_id and id = p_user_id;

  select name into v_workspace from public.workspaces where id = v_workspace_id;
  select full_name into v_name from public.profiles where id = p_user_id;

  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
  values (v_workspace_id, (select auth.uid()), 'editor.approved', 'editor', p_user_id,
          v_name || ' was approved and joined the team');

  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  values (v_workspace_id, p_user_id, 'onboarding_approved', 'You''re in: welcome to ' || v_workspace,
          'Your full workspace is open', '/dashboard', 'editor', p_user_id);
end;
$$;

-- Ends an onboarding editor's access to the current workspace. Their
-- history stays (with their name); open interviews are cancelled.
create or replace function public.reject_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (select public.current_workspace_id());
  v_name text;
begin
  if not public.is_admin_of(v_workspace_id) then
    raise exception 'Only an admin can decide on editors.' using errcode = '42501';
  end if;
  perform set_config('foundry.membership_change', 'on', true);

  update public.workspace_members
     set status = 'rejected', approved_at = null, approved_by = null
   where workspace_id = v_workspace_id and user_id = p_user_id and role = 'editor' and status = 'onboarding';
  if not found then
    raise exception 'not_onboarding' using errcode = 'P0001';
  end if;

  update public.editors set is_active = false where workspace_id = v_workspace_id and id = p_user_id;
  update public.editor_interviews set outcome = 'cancelled'
   where workspace_id = v_workspace_id and editor_id = p_user_id and outcome = 'scheduled';
  update public.applicants a set stage = 'rejected'
    from public.editors e
   where e.workspace_id = v_workspace_id and e.id = p_user_id and a.id = e.applicant_id;

  select full_name into v_name from public.profiles where id = p_user_id;
  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
  values (v_workspace_id, (select auth.uid()), 'editor.rejected', 'editor', p_user_id,
          v_name || ' wasn''t taken on after onboarding');
end;
$$;

revoke all on function public.approve_member(uuid) from public, anon;
grant execute on function public.approve_member(uuid) to authenticated;
revoke all on function public.reject_member(uuid) from public, anon;
grant execute on function public.reject_member(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: the onboarding page and the editor's profile refresh live
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.editor_interviews;
