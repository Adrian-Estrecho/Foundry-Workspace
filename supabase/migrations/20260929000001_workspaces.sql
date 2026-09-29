-- =============================================================================
-- Foundry · 0007 · Workspaces (Phase 4.5): schema
--   * Foundry becomes multi-tenant. A workspace is one company. People belong
--     to it through workspace_members, with a role (owner, admin, editor) and
--     a status (onboarding, active, rejected, left). One account can belong
--     to many workspaces; profiles.active_workspace_id is the one in use.
--   * Company settings move from the app_settings singleton onto workspaces.
--   * Every tenant table gets workspace_id. Child rows take it from their
--     parent (set_workspace_id trigger), and no row can move workspace.
--   * editors becomes per workspace: its key is (workspace_id, id), where id
--     is still the user's id, and every table that points at an editor points
--     at that pair.
--   * An existing single-company database becomes the "Foundry Media"
--     workspace. A fresh one gets nothing here (seed.sql makes its own).
-- Behaviour is rewritten in 0008 and access control in 0009, which also
-- drops app_settings and profiles.role.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types & tables
-- -----------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'editor');

-- onboarding: joined through an invitation, limited access until approved
-- active:     full access for their role
-- rejected / left: no access; kept so their history still has a name
create type public.member_status as enum ('onboarding', 'active', 'rejected', 'left');

-- Hiring and onboarding notifications. Added here, a migration before any
-- function uses them (a new enum value can't be used in the transaction that
-- adds it).
alter type public.notification_type add value 'member_joined';        -- admin: someone joined with an invitation
alter type public.notification_type add value 'onboarding_ready';     -- admin: every onboarding step is done
alter type public.notification_type add value 'interview_scheduled';  -- editor
alter type public.notification_type add value 'onboarding_approved';  -- editor
alter type public.notification_type add value 'onboarding_rejected';  -- editor

create table public.workspaces (
  id                             uuid primary key default gen_random_uuid(),
  name                           text not null check (char_length(trim(name)) between 2 and 60),
  -- Used in public links: /apply/<slug>, /intake/<slug>.
  slug                           text not null unique
                                   check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  accepting_applications         boolean not null default true,
  default_accent                 text not null default '#F2711C'
                                   check (default_accent ~ '^#[0-9a-fA-F]{6}$'),
  missed_clock_in_grace_minutes  integer not null default 60 check (missed_clock_in_grace_minutes >= 0),
  -- Links editors use during onboarding.
  asset_pack_url                 text,
  frameio_invite_url             text,
  contract_template_url          text,
  created_by                     uuid references public.profiles (id) on delete set null,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id           uuid not null references public.workspaces (id) on delete cascade,
  user_id                uuid not null references public.profiles (id) on delete cascade,
  role                   public.member_role not null default 'editor',
  status                 public.member_status not null default 'onboarding',
  joined_at              timestamptz not null default now(),
  approved_at            timestamptz,
  approved_by            uuid references public.profiles (id) on delete set null,
  announcements_seen_at  timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);
create unique index workspace_members_one_owner on public.workspace_members (workspace_id) where role = 'owner';

create trigger set_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workspace_members
  for each row execute function public.set_updated_at();

-- The workspace the user is working in. Switching workspace changes it; RLS
-- only shows rows from it (see current_workspace_id()).
alter table public.profiles
  add column active_workspace_id uuid references public.workspaces (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Existing single-company data → the "Foundry Media" workspace
-- -----------------------------------------------------------------------------
do $$
declare
  v_owner uuid;
begin
  if not exists (select 1 from public.profiles) then
    return;
  end if;

  select id into v_owner from public.profiles where role = 'admin' order by created_at limit 1;
  if v_owner is null then
    raise exception 'Found profiles but no admin to own the Foundry Media workspace.';
  end if;

  insert into public.workspaces (
    id, name, slug, default_accent, missed_clock_in_grace_minutes,
    asset_pack_url, frameio_invite_url, contract_template_url, created_by, created_at
  )
  select
    '90000000-0000-4000-8000-000000000001', s.company_name, 'foundry-media', s.default_accent,
    s.missed_clock_in_grace_minutes, s.asset_pack_url, s.frameio_invite_url, s.contract_template_url,
    v_owner, (select min(created_at) from public.profiles)
  from public.app_settings s
  where s.id = 1;

  insert into public.workspace_members (
    workspace_id, user_id, role, status, joined_at, approved_at, announcements_seen_at
  )
  select
    '90000000-0000-4000-8000-000000000001',
    p.id,
    case when p.id = v_owner then 'owner' when p.role = 'admin' then 'admin' else 'editor' end::public.member_role,
    case when p.role = 'admin' or e.onboarding_completed_at is not null then 'active' else 'onboarding' end::public.member_status,
    p.created_at,
    case when p.role = 'admin' then p.created_at else e.onboarding_completed_at end,
    p.announcements_seen_at
  from public.profiles p
  left join public.editors e on e.id = p.id;

  update public.profiles set active_workspace_id = '90000000-0000-4000-8000-000000000001';
end;
$$;

-- -----------------------------------------------------------------------------
-- workspace_id on every tenant table
-- Added with the Foundry Media id as a constant default, which fills existing
-- rows without rewriting them or firing triggers. The real defaults are set
-- once current_workspace_id() exists (below).
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'leads', 'clients', 'client_checklist_items', 'applicants', 'editors', 'editor_documents',
    'editor_payment_details', 'editor_checklist_items', 'projects', 'project_editors', 'tasks',
    'subtasks', 'task_attachments', 'task_comments', 'shifts', 'time_logs', 'status_events',
    'shift_reports', 'meetings', 'meeting_rsvps', 'announcements', 'announcement_comments',
    'announcement_reactions', 'ideas', 'sops', 'sop_acknowledgments', 'notifications', 'activity_log'
  ] loop
    execute format(
      'alter table public.%I add column workspace_id uuid not null
         default %L references public.workspaces (id) on delete cascade',
      t, '90000000-0000-4000-8000-000000000001');
  end loop;

  -- Plain lookups by workspace. (editors and editor_payment_details get it
  -- from their new primary keys; the pipelines and feed get composite
  -- indexes below.)
  foreach t in array array[
    'leads', 'client_checklist_items', 'editor_documents', 'editor_checklist_items', 'projects',
    'project_editors', 'tasks', 'subtasks', 'task_attachments', 'task_comments', 'shifts',
    'time_logs', 'status_events', 'shift_reports', 'meetings', 'meeting_rsvps', 'announcements',
    'announcement_comments', 'announcement_reactions', 'ideas', 'sops', 'sop_acknowledgments',
    'notifications'
  ] loop
    execute format('create index %I on public.%I (workspace_id)', t || '_workspace_idx', t);
  end loop;
end;
$$;

drop index public.clients_stage_position_idx;
create index clients_stage_position_idx on public.clients (workspace_id, stage, position);
drop index public.applicants_stage_position_idx;
create index applicants_stage_position_idx on public.applicants (workspace_id, stage, position);
drop index public.activity_log_created_idx;
create index activity_log_created_idx on public.activity_log (workspace_id, created_at desc);
drop index public.announcements_created_idx;
create index announcements_created_idx on public.announcements (workspace_id, is_pinned desc, created_at desc);

-- -----------------------------------------------------------------------------
-- Editors are per workspace
-- The key becomes (workspace_id, id). id is still the user's id, so
-- "assignee_id = auth.uid()" style checks keep working. Every reference to
-- an editor becomes (workspace_id, editor_id), keeping the constraint names
-- the app uses as embed hints. An editor row also needs a membership.
-- -----------------------------------------------------------------------------
alter table public.editors drop constraint editors_pkey cascade;
alter table public.editors add constraint editors_pkey primary key (workspace_id, id);
alter table public.editors
  add constraint editors_member_fkey
  foreign key (workspace_id, id) references public.workspace_members (workspace_id, user_id);
create index editors_id_idx on public.editors (id);

alter table public.editor_payment_details drop constraint editor_payment_details_pkey;
alter table public.editor_payment_details add constraint editor_payment_details_pkey primary key (workspace_id, editor_id);

alter table public.editor_checklist_items drop constraint editor_checklist_items_editor_id_key_key;
alter table public.editor_checklist_items
  add constraint editor_checklist_items_editor_id_key_key unique (workspace_id, editor_id, key);

alter table public.applicants
  add constraint applicants_editor_id_fkey foreign key (workspace_id, editor_id)
    references public.editors (workspace_id, id) on delete set null (editor_id);
alter table public.tasks
  add constraint tasks_assignee_id_fkey foreign key (workspace_id, assignee_id)
    references public.editors (workspace_id, id) on delete set null (assignee_id);
alter table public.editor_documents
  add constraint editor_documents_editor_id_fkey foreign key (workspace_id, editor_id)
    references public.editors (workspace_id, id) on delete cascade;
alter table public.editor_payment_details
  add constraint editor_payment_details_editor_id_fkey foreign key (workspace_id, editor_id)
    references public.editors (workspace_id, id) on delete cascade;
alter table public.editor_checklist_items
  add constraint editor_checklist_items_editor_id_fkey foreign key (workspace_id, editor_id)
    references public.editors (workspace_id, id) on delete cascade;
alter table public.project_editors
  add constraint project_editors_editor_id_fkey foreign key (workspace_id, editor_id)
    references public.editors (workspace_id, id) on delete cascade;
alter table public.shifts
  add constraint shifts_editor_id_fkey foreign key (workspace_id, editor_id)
    references public.editors (workspace_id, id) on delete cascade;
alter table public.time_logs
  add constraint time_logs_editor_id_fkey foreign key (workspace_id, editor_id)
    references public.editors (workspace_id, id) on delete cascade;
alter table public.status_events
  add constraint status_events_editor_id_fkey foreign key (workspace_id, editor_id)
    references public.editors (workspace_id, id) on delete cascade;
alter table public.shift_reports
  add constraint shift_reports_editor_id_fkey foreign key (workspace_id, editor_id)
    references public.editors (workspace_id, id) on delete cascade;
alter table public.sop_acknowledgments
  add constraint sop_acknowledgments_editor_id_fkey foreign key (workspace_id, editor_id)
    references public.editors (workspace_id, id) on delete cascade;

-- shifts_one_open_per_editor and time_logs_one_open_per_editor stay keyed on
-- the person alone: nobody is clocked in at two companies at once.

-- -----------------------------------------------------------------------------
-- Workspace helpers (security definer so policies can call them without
-- recursing into the RLS of the tables they read)
-- -----------------------------------------------------------------------------

-- The workspace the user is working in: their active workspace, as long as
-- they are still onboarding or active there. Null otherwise, which RLS
-- treats as "no rows".
create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.workspace_id
  from public.profiles p
  join public.workspace_members m on m.workspace_id = p.active_workspace_id and m.user_id = p.id
  where p.id = (select auth.uid())
    and m.status in ('onboarding', 'active');
$$;

-- Owner or admin of the current workspace.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.workspace_members m on m.workspace_id = p.active_workspace_id and m.user_id = p.id
    where p.id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

-- Admin, or an editor who has been approved (not still onboarding).
create or replace function public.is_full_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.workspace_members m on m.workspace_id = p.active_workspace_id and m.user_id = p.id
    where p.id = (select auth.uid())
      and m.status = 'active'
  );
$$;

-- For RPCs that act on a row of a given workspace (not the session's).
create or replace function public.is_admin_of(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = (select auth.uid())
      and status = 'active'
      and role in ('owner', 'admin')
  );
$$;

-- The owners and admins of a workspace: who hears about new leads,
-- applicants, work ready for review and onboarding.
create or replace function public.workspace_admin_ids(p_workspace_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select user_id from public.workspace_members
  where workspace_id = p_workspace_id
    and status = 'active'
    and role in ('owner', 'admin');
$$;

-- Tenant tables default to the caller's workspace. Notifications and the
-- activity feed are only written by triggers and server code, which must
-- name the workspace: no default, so a missing one fails loudly.
do $$
declare
  t text;
begin
  foreach t in array array[
    'leads', 'clients', 'client_checklist_items', 'applicants', 'editors', 'editor_documents',
    'editor_payment_details', 'editor_checklist_items', 'projects', 'project_editors', 'tasks',
    'subtasks', 'task_attachments', 'task_comments', 'shifts', 'time_logs', 'status_events',
    'shift_reports', 'meetings', 'meeting_rsvps', 'announcements', 'announcement_comments',
    'announcement_reactions', 'ideas', 'sops', 'sop_acknowledgments'
  ] loop
    execute format('alter table public.%I alter column workspace_id set default public.current_workspace_id()', t);
  end loop;
end;
$$;

alter table public.notifications alter column workspace_id drop default;
alter table public.activity_log alter column workspace_id drop default;

-- -----------------------------------------------------------------------------
-- Rows stay in their parent's workspace
-- Child rows take workspace_id from their parent (arguments: parent table,
-- column), so neither the app nor trigger code has to pass it. Because RLS
-- checks the row after BEFORE triggers run, a child pointing at a parent in
-- another workspace is then refused. No row can change workspace.
-- -----------------------------------------------------------------------------
create or replace function public.set_workspace_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_id uuid;
  v_workspace_id uuid;
begin
  if tg_nargs = 2
     and (tg_op = 'INSERT' or (to_jsonb(new) ->> tg_argv[1]) is distinct from (to_jsonb(old) ->> tg_argv[1])) then
    v_parent_id := (to_jsonb(new) ->> tg_argv[1])::uuid;
    if v_parent_id is not null then
      execute format('select workspace_id from public.%I where id = $1', tg_argv[0])
        into v_workspace_id using v_parent_id;
      if v_workspace_id is not null then
        new.workspace_id := v_workspace_id;
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.workspace_id is distinct from old.workspace_id then
    raise exception 'Rows can''t move to another workspace.' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('clients',                'leads',         'lead_id'),
      ('client_checklist_items', 'clients',       'client_id'),
      ('projects',               'clients',       'client_id'),
      ('project_editors',        'projects',      'project_id'),
      ('tasks',                  'projects',      'project_id'),
      ('subtasks',               'tasks',         'task_id'),
      ('task_attachments',       'tasks',         'task_id'),
      ('task_comments',          'tasks',         'task_id'),
      ('time_logs',              'shifts',        'shift_id'),
      ('status_events',          'shifts',        'shift_id'),
      ('shift_reports',          'shifts',        'shift_id'),
      ('meeting_rsvps',          'meetings',      'meeting_id'),
      ('announcements',          'meetings',      'meeting_id'),
      ('announcement_comments',  'announcements', 'announcement_id'),
      ('announcement_reactions', 'announcements', 'announcement_id'),
      ('sop_acknowledgments',    'sops',          'sop_id')
    ) as v(child, parent, col)
  loop
    execute format(
      'create trigger set_workspace_id before insert or update on public.%I
         for each row execute function public.set_workspace_id(%L, %L)',
      r.child, r.parent, r.col);
  end loop;

  -- Tables with no parent to follow: only the "can't move" check.
  for r in
    select unnest(array[
      'leads', 'applicants', 'editors', 'editor_documents', 'editor_payment_details',
      'editor_checklist_items', 'shifts', 'meetings', 'ideas', 'sops', 'notifications', 'activity_log'
    ]) as child
  loop
    execute format(
      'create trigger set_workspace_id before update on public.%I
         for each row execute function public.set_workspace_id()', r.child);
  end loop;
end;
$$;
