-- =============================================================================
-- Foundry · 0004 · Clients (Phase 2)
--   * Public intake → lead + pipeline card, atomically and rate limited
--   * Onboarding checklist created when a client reaches "Contract Signed"
--   * Checklist items that can be derived tick themselves
--   * Stage bookkeeping, activity feed entries, new-lead notifications
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.client_stage_label(p_stage public.client_stage)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'new_lead'        then 'New Lead'
    when 'discovery_call'  then 'Discovery Call'
    when 'contract_sent'   then 'Contract Sent'
    when 'contract_signed' then 'Contract Signed'
    when 'deposit_paid'    then 'Deposit Paid'
    when 'kickoff'         then 'Kickoff'
    when 'active_client'   then 'Active Client'
    when 'completed'       then 'Completed'
  end;
$$;

-- "Northwind Fitness", or the contact's name when there's no company.
create or replace function public.client_display_name(p_company text, p_contact_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(trim(p_company), ''), p_contact_name);
$$;

-- -----------------------------------------------------------------------------
-- Onboarding checklist
-- -----------------------------------------------------------------------------
create or replace function public.ensure_client_checklist(p_client_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.client_checklist_items (client_id, key, label, position)
  values
    (p_client_id, 'contract_uploaded', 'Contract signed and uploaded',        1),
    (p_client_id, 'deposit_received',  'Deposit received',                    2),
    (p_client_id, 'drive_folder',      'Drive folder created and link added', 3),
    (p_client_id, 'brief_collected',   'Brief and references collected',      4),
    (p_client_id, 'editor_assigned',   'Editor assigned',                     5),
    (p_client_id, 'kickoff_done',      'Kickoff call done',                   6)
  on conflict (client_id, key) do nothing;
$$;

-- Ticks the items Foundry can work out for itself. Only ever ticks: an admin
-- can still untick by hand, and nothing is created before "Contract Signed".
create or replace function public.sync_client_checklist(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients%rowtype;
  v_keys text[] := '{}';
begin
  select * into v_client from public.clients where id = p_client_id;
  if not found then
    return;
  end if;

  if v_client.contract_path is not null then
    v_keys := array_append(v_keys, 'contract_uploaded');
  end if;
  if v_client.deposit_status = 'paid' then
    v_keys := array_append(v_keys, 'deposit_received');
  end if;
  if nullif(trim(v_client.drive_folder_url), '') is not null then
    v_keys := array_append(v_keys, 'drive_folder');
  end if;
  if exists (
    select 1
    from public.project_editors pe
    join public.projects p on p.id = pe.project_id
    where p.client_id = p_client_id
  ) then
    v_keys := array_append(v_keys, 'editor_assigned');
  end if;

  update public.client_checklist_items
     set is_done = true, done_at = now(), done_by = (select auth.uid())
   where client_id = p_client_id
     and key = any (v_keys)
     and not is_done;
end;
$$;

create or replace function public.on_client_saved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stage >= 'contract_signed' then
    perform public.ensure_client_checklist(new.id);
  end if;
  perform public.sync_client_checklist(new.id);
  return null;
end;
$$;

create trigger on_client_saved
  after insert or update of stage, contract_path, deposit_status, drive_folder_url on public.clients
  for each row execute function public.on_client_saved();

-- Assigning an editor to any of the client's projects ticks "Editor assigned".
create or replace function public.on_project_editor_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_client_checklist((select client_id from public.projects where id = new.project_id));
  return null;
end;
$$;

create trigger on_project_editor_added
  after insert on public.project_editors
  for each row execute function public.on_project_editor_added();

-- Log once when the whole checklist is done.
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

    insert into public.activity_log (actor_id, action, entity_type, entity_id, summary)
    values ((select auth.uid()), 'client.onboarding_completed', 'client', new.client_id,
            v_name || ' finished client onboarding');
  end if;
  return null;
end;
$$;

create trigger on_client_checklist_ticked
  after update of is_done on public.client_checklist_items
  for each row execute function public.on_client_checklist_ticked();

-- -----------------------------------------------------------------------------
-- Stage bookkeeping, activity feed, new-lead notifications
-- -----------------------------------------------------------------------------
create or replace function public.touch_client_stage()
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

create trigger touch_client_stage
  before update of stage on public.clients
  for each row execute function public.touch_client_stage();

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
      insert into public.activity_log (actor_id, action, entity_type, entity_id, summary, meta, created_at)
      values (null, 'lead.created', 'client', new.id, 'New lead: ' || v_name,
              jsonb_build_object('project_type', new.project_type, 'budget_range', new.budget_range),
              new.created_at);

      insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id, created_at)
      select p.id, 'new_lead', 'New lead: ' || v_name,
             nullif(concat_ws(' · ', new.project_type, new.budget_range), ''),
             '/clients/' || new.id, 'client', new.id, new.created_at
      from public.profiles p
      where p.role = 'admin';
    else
      insert into public.activity_log (actor_id, action, entity_type, entity_id, summary, created_at)
      values ((select auth.uid()), 'client.created', 'client', new.id, 'Client added: ' || v_name, new.created_at);
    end if;
  elsif new.stage is distinct from old.stage then
    insert into public.activity_log (actor_id, action, entity_type, entity_id, summary, meta)
    values ((select auth.uid()), 'client.stage_changed', 'client', new.id,
            v_name || ' moved to ' || public.client_stage_label(new.stage),
            jsonb_build_object('from', old.stage, 'to', new.stage));
  end if;
  return null;
end;
$$;

create trigger log_client_activity
  after insert or update of stage on public.clients
  for each row execute function public.log_client_activity();

-- New projects show up in the activity feed (created from the Kickoff prompt,
-- the client page, or later the Projects module).
create or replace function public.log_project_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_log (actor_id, action, entity_type, entity_id, summary, created_at)
  select (select auth.uid()), 'project.created', 'project', new.id,
         'New project for ' || public.client_display_name(c.company, c.contact_name) || ': ' || new.name,
         new.created_at
  from public.clients c
  where c.id = new.client_id;
  return null;
end;
$$;

create trigger log_project_created
  after insert on public.projects
  for each row execute function public.log_project_created();

-- -----------------------------------------------------------------------------
-- Public intake. Called only by the server (service role) after spam checks;
-- inserts the raw lead and its pipeline card together. Rate limited per email
-- and overall as a last line of defence.
-- -----------------------------------------------------------------------------
create or replace function public.submit_intake(
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
      where lower(email) = lower(p_email) and created_at > now() - interval '10 minutes') >= 3
  or (select count(*) from public.leads where created_at > now() - interval '10 minutes') >= 50 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.leads (name, company, email, phone, project_type, budget_range, deadline, reference_links, notes)
  values (p_name, p_company, lower(p_email), p_phone, p_project_type, p_budget_range, p_deadline,
          coalesce(p_reference_links, '{}'), p_notes)
  returning id into v_lead_id;

  -- New leads go to the top of their column.
  insert into public.clients (lead_id, contact_name, company, email, phone, project_type, budget_range, deadline, position)
  values (v_lead_id, p_name, p_company, lower(p_email), p_phone, p_project_type, p_budget_range, p_deadline,
          coalesce((select min(position) from public.clients where stage = 'new_lead'), 1) - 1)
  returning id into v_client_id;

  return v_client_id;
end;
$$;

revoke all on function public.submit_intake(text, text, text, text, text, text, date, text[], text)
  from public, anon, authenticated;
grant execute on function public.submit_intake(text, text, text, text, text, text, date, text[], text)
  to service_role;

-- Internal helpers are not part of the API.
revoke all on function public.ensure_client_checklist(uuid) from public, anon, authenticated;
revoke all on function public.sync_client_checklist(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: the pipeline board refreshes live
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.clients,
  public.client_checklist_items,
  public.projects;
