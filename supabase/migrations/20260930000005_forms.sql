-- =============================================================================
-- Foundry · Editable public forms
--   * Owners and admins can change the application form (/apply/<slug>) and
--     the project form (/intake/<slug>): relabel, reorder, hide optional
--     questions, and add their own (text, choices, links, sections...).
--     workspace_forms keeps each form's field list; no row means the
--     built-in default form.
--   * Answers to their own questions are kept on the submission, in
--     applicants.answers and leads.answers, as [{id, label, type, value}].
--     The label is copied at the time, so answers still read right after the
--     form changes.
--   * submit_application and submit_intake take them as p_answers.
-- =============================================================================

create table public.workspace_forms (
  workspace_id  uuid not null default public.current_workspace_id()
                  references public.workspaces (id) on delete cascade,
  kind          text not null check (kind in ('apply', 'intake')),
  fields        jsonb not null check (jsonb_typeof(fields) = 'array'),
  updated_by    uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, kind)
);

create trigger set_updated_at before update on public.workspace_forms
  for each row execute function public.set_updated_at();
create trigger set_workspace_id before update on public.workspace_forms
  for each row execute function public.set_workspace_id();

alter table public.workspace_forms enable row level security;
create policy "current workspace only" on public.workspace_forms
  as restrictive for all to authenticated
  using (workspace_id = (select public.current_workspace_id()))
  with check (workspace_id = (select public.current_workspace_id()));
create policy "admin full access" on public.workspace_forms
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

alter table public.applicants
  add column answers jsonb not null default '[]' check (jsonb_typeof(answers) = 'array');
alter table public.leads
  add column answers jsonb not null default '[]' check (jsonb_typeof(answers) = 'array');

-- -----------------------------------------------------------------------------
-- Submissions carry the answers to the workspace's own questions
-- -----------------------------------------------------------------------------
drop function public.submit_intake(uuid, text, text, text, text, text, text, date, text[], text);

create function public.submit_intake(
  p_workspace_id uuid,
  p_name text,
  p_email text,
  p_company text default null,
  p_phone text default null,
  p_project_type text default null,
  p_budget_range text default null,
  p_deadline date default null,
  p_reference_links text[] default '{}',
  p_notes text default null,
  p_answers jsonb default '[]'
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

  insert into public.leads (workspace_id, name, company, email, phone, project_type, budget_range, deadline,
                            reference_links, notes, answers)
  values (p_workspace_id, p_name, p_company, lower(p_email), p_phone, p_project_type, p_budget_range, p_deadline,
          coalesce(p_reference_links, '{}'), p_notes, coalesce(p_answers, '[]'))
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

revoke all on function public.submit_intake(uuid, text, text, text, text, text, text, date, text[], text, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_intake(uuid, text, text, text, text, text, text, date, text[], text, jsonb)
  to service_role;

drop function public.submit_application(uuid, text, text, text, text[], text[], text, numeric, integer, text);

create function public.submit_application(
  p_workspace_id uuid,
  p_full_name text,
  p_email text,
  p_portfolio_url text default null,
  p_software text[] default '{}',
  p_specialties text[] default '{}',
  p_timezone text default null,
  p_hourly_rate numeric default null,
  p_weekly_hours integer default null,
  p_availability_notes text default null,
  p_answers jsonb default '[]'
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
    weekly_hours, availability_notes, answers, position
  )
  values (
    p_workspace_id, p_full_name, lower(p_email), p_portfolio_url, coalesce(p_software, '{}'),
    coalesce(p_specialties, '{}'), p_timezone, p_hourly_rate, p_weekly_hours, p_availability_notes,
    coalesce(p_answers, '[]'),
    coalesce((select min(position) from public.applicants
              where workspace_id = p_workspace_id and stage = 'applied'), 1) - 1
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_application(uuid, text, text, text, text[], text[], text, numeric, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_application(uuid, text, text, text, text[], text[], text, numeric, integer, text, jsonb)
  to service_role;
