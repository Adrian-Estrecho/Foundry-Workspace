-- =============================================================================
-- Foundry · 0001 · Core schema
-- Enums, tables, indexes and foreign keys for every module.
-- Behaviour (triggers, helper functions) lives in 0002_core.sql and access
-- control (RLS, storage) in 0003_rls.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'editor');

create type public.client_stage as enum (
  'new_lead', 'discovery_call', 'contract_sent', 'contract_signed',
  'deposit_paid', 'kickoff', 'active_client', 'completed'
);

create type public.applicant_stage as enum (
  'applied', 'test_edit_sent', 'test_submitted', 'interview', 'approved', 'rejected'
);

create type public.project_status as enum (
  'brief_received', 'in_progress', 'internal_review', 'client_review', 'revisions', 'delivered'
);

create type public.task_status as enum ('todo', 'in_progress', 'for_review', 'revisions', 'done');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');

-- What the editor has switched on. "Online / Offline" is not stored here: it
-- comes from Realtime Presence (is the editor connected right now?).
create type public.work_status as enum ('off', 'working', 'on_break');

create type public.payment_status as enum ('unpaid', 'paid');
create type public.rsvp_status as enum ('going', 'maybe', 'declined');

create type public.sop_category as enum (
  'editing_workflow', 'frameio_review', 'file_naming_delivery', 'communication'
);

create type public.notification_type as enum (
  -- admin
  'new_lead', 'new_applicant', 'task_for_review', 'task_overdue', 'editor_onboarded',
  'missed_clock_in', 'offline_with_overdue',
  -- editor
  'task_assigned', 'task_due_tomorrow', 'revision_requested', 'new_announcement',
  'meeting_reminder',
  -- both
  'mention'
);

-- -----------------------------------------------------------------------------
-- Identity & settings
-- -----------------------------------------------------------------------------

-- One row per auth user. Created by the handle_new_user trigger.
create table public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  role                   public.user_role not null default 'editor',
  full_name              text not null default '',
  email                  text not null,
  avatar_url             text,
  phone                  text,
  timezone               text not null default 'UTC',
  -- Appearance: personal accent (null = company default) and whether the
  -- neutral background picks up a hint of the accent hue.
  accent_color           text check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  tint_background        boolean not null default true,
  announcements_seen_at  timestamptz not null default now(),
  last_seen_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Single-row company settings.
create table public.app_settings (
  id                             smallint primary key default 1 check (id = 1),
  company_name                   text not null default 'Foundry Media',
  default_accent                 text not null default '#F2711C'
                                   check (default_accent ~ '^#[0-9a-fA-F]{6}$'),
  admin_email                    text,
  missed_clock_in_grace_minutes  integer not null default 60 check (missed_clock_in_grace_minutes >= 0),
  asset_pack_url                 text,
  frameio_invite_url             text,
  updated_at                     timestamptz not null default now()
);
insert into public.app_settings (id) values (1);

-- -----------------------------------------------------------------------------
-- Clients
-- -----------------------------------------------------------------------------

-- Raw public intake submission. Kept as the original record; the pipeline
-- works on `clients`.
create table public.leads (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  company          text,
  email            text not null,
  phone            text,
  project_type     text,
  budget_range     text,
  deadline         date,
  reference_links  text[] not null default '{}',
  notes            text,
  created_at       timestamptz not null default now()
);

create table public.clients (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid unique references public.leads (id) on delete set null,
  contact_name      text not null,
  company           text,
  email             text,
  phone             text,
  stage             public.client_stage not null default 'new_lead',
  position          double precision not null default 0,   -- order within a kanban column
  stage_changed_at  timestamptz not null default now(),
  project_type      text,
  budget_range      text,
  deadline          date,
  call_notes        text,
  drive_folder_url  text,
  contract_path     text,                                   -- storage: contracts/<client_id>/...
  deposit_status    public.payment_status not null default 'unpaid',
  final_status      public.payment_status not null default 'unpaid',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index clients_stage_position_idx on public.clients (stage, position);

create table public.client_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  key        text not null,
  label      text not null,
  position   smallint not null,
  is_done    boolean not null default false,
  done_at    timestamptz,
  done_by    uuid references public.profiles (id) on delete set null,
  unique (client_id, key)
);

-- -----------------------------------------------------------------------------
-- Editors
-- -----------------------------------------------------------------------------

create table public.applicants (
  id                   uuid primary key default gen_random_uuid(),
  full_name            text not null,
  email                text not null,
  portfolio_url        text,
  software             text[] not null default '{}',
  specialties          text[] not null default '{}',
  timezone             text,
  hourly_rate          numeric(10, 2) check (hourly_rate >= 0),
  weekly_hours         integer check (weekly_hours between 0 and 168),
  availability_notes   text,
  stage                public.applicant_stage not null default 'applied',
  position             double precision not null default 0,
  stage_changed_at     timestamptz not null default now(),
  test_edit_url        text,
  test_submission_url  text,
  admin_notes          text,
  rating               smallint check (rating between 1 and 5),
  editor_id            uuid,                                -- FK added below
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index applicants_stage_position_idx on public.applicants (stage, position);

create table public.editors (
  id                       uuid primary key references public.profiles (id) on delete cascade,
  applicant_id             uuid unique references public.applicants (id) on delete set null,
  software                 text[] not null default '{}',
  specialties              text[] not null default '{}',
  hourly_rate              numeric(10, 2) check (hourly_rate >= 0),
  weekly_hours             integer check (weekly_hours between 0 and 168),
  work_days                smallint[] not null default '{1,2,3,4,5}',  -- ISO weekday, 1 = Monday
  shift_start              time not null default '09:00',
  is_active                boolean not null default true,
  onboarding_completed_at  timestamptz,
  -- Live working state. Only the attendance functions write these.
  work_status              public.work_status not null default 'off',
  current_task_id          uuid,                            -- FK added below
  current_shift_id         uuid,                            -- FK added below
  status_since             timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.applicants
  add constraint applicants_editor_id_fkey
  foreign key (editor_id) references public.editors (id) on delete set null;

create table public.editor_documents (
  id            uuid primary key default gen_random_uuid(),
  editor_id     uuid not null references public.editors (id) on delete cascade,
  doc_type      text not null check (doc_type in ('contract', 'nda', 'other')),
  storage_path  text not null,                              -- storage: editor-docs/<editor_id>/...
  file_name     text not null,
  uploaded_at   timestamptz not null default now()
);
create index editor_documents_editor_idx on public.editor_documents (editor_id);

-- Kept apart from `editors` so it can have its own, stricter policies.
create table public.editor_payment_details (
  editor_id   uuid primary key references public.editors (id) on delete cascade,
  method      text not null,                                -- e.g. bank, paypal, wise
  details     jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

create table public.editor_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  editor_id  uuid not null references public.editors (id) on delete cascade,
  key        text not null,
  label      text not null,
  position   smallint not null,
  is_done    boolean not null default false,
  done_at    timestamptz,
  unique (editor_id, key)
);

-- -----------------------------------------------------------------------------
-- Projects & tasks
-- -----------------------------------------------------------------------------

create table public.projects (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete restrict,
  name               text not null,
  status             public.project_status not null default 'brief_received',
  deadline           date,
  drive_folder_url   text,
  frameio_url        text,
  spec_format        text,                                  -- e.g. MP4 H.264
  spec_aspect_ratio  text,                                  -- e.g. 9:16
  spec_length        text,                                  -- e.g. 30–60s
  spec_notes         text,
  created_by         uuid references public.profiles (id) on delete set null,
  delivered_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index projects_client_idx on public.projects (client_id);
create index projects_status_idx on public.projects (status);

create table public.project_editors (
  project_id  uuid not null references public.projects (id) on delete cascade,
  editor_id   uuid not null references public.editors (id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (project_id, editor_id)
);
create index project_editors_editor_idx on public.project_editors (editor_id);

create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  -- Null for internal work that isn't tied to a client project
  -- (trial tasks, tasks converted from ideas).
  project_id      uuid references public.projects (id) on delete cascade,
  title           text not null,
  description     text,
  assignee_id     uuid references public.editors (id) on delete set null,
  due_date        date,
  priority        public.task_priority not null default 'medium',
  status          public.task_status not null default 'todo',
  position        double precision not null default 0,
  revision_count  integer not null default 0 check (revision_count >= 0),
  progress_pct    smallint not null default 0 check (progress_pct between 0 and 100),
  is_trial        boolean not null default false,
  idea_id         uuid,                                     -- FK added below
  created_by      uuid references public.profiles (id) on delete set null,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tasks_assignee_status_idx on public.tasks (assignee_id, status);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_open_due_idx on public.tasks (due_date) where status <> 'done';

create table public.subtasks (
  id        uuid primary key default gen_random_uuid(),
  task_id   uuid not null references public.tasks (id) on delete cascade,
  title     text not null,
  is_done   boolean not null default false,
  position  double precision not null default 0
);
create index subtasks_task_idx on public.subtasks (task_id);

create table public.task_attachments (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks (id) on delete cascade,
  kind          text not null check (kind in ('link', 'file')),
  url           text,                                       -- for links
  storage_path  text,                                       -- for files: task-files/<task_id>/...
  label         text,
  added_by      uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  check ((kind = 'link' and url is not null) or (kind = 'file' and storage_path is not null))
);
create index task_attachments_task_idx on public.task_attachments (task_id);

create table public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null,
  mentions    uuid[] not null default '{}',
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);

-- -----------------------------------------------------------------------------
-- Attendance
-- -----------------------------------------------------------------------------

-- A shift runs from "Start working" to "Stop working".
create table public.shifts (
  id             uuid primary key default gen_random_uuid(),
  editor_id      uuid not null references public.editors (id) on delete cascade,
  clock_in_at    timestamptz not null default now(),
  clock_out_at   timestamptz,
  work_date      date not null,                             -- in the editor's timezone
  work_seconds   integer not null default 0,                -- filled at clock-out
  break_seconds  integer not null default 0,
  ended_by       text check (ended_by in ('editor', 'admin')),
  created_at     timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at >= clock_in_at)
);
create unique index shifts_one_open_per_editor on public.shifts (editor_id) where clock_out_at is null;
create index shifts_editor_date_idx on public.shifts (editor_id, work_date);

-- Time spent on a specific task. Switching task closes one log and opens the next.
create table public.time_logs (
  id          uuid primary key default gen_random_uuid(),
  editor_id   uuid not null references public.editors (id) on delete cascade,
  shift_id    uuid not null references public.shifts (id) on delete cascade,
  task_id     uuid references public.tasks (id) on delete set null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  seconds     integer generated always as (
                case when ended_at is null then null
                     else extract(epoch from (ended_at - started_at))::integer end
              ) stored,
  check (ended_at is null or ended_at >= started_at)
);
create unique index time_logs_one_open_per_editor on public.time_logs (editor_id) where ended_at is null;
create index time_logs_task_idx on public.time_logs (task_id);
create index time_logs_started_idx on public.time_logs (started_at);

-- Append-only history of status changes (used for break totals and audit).
create table public.status_events (
  id          bigint generated always as identity primary key,
  editor_id   uuid not null references public.editors (id) on delete cascade,
  shift_id    uuid references public.shifts (id) on delete cascade,
  status      public.work_status not null,
  task_id     uuid references public.tasks (id) on delete set null,
  reason      text not null check (reason in ('clock_in', 'clock_out', 'break', 'resume', 'task_switch', 'admin')),
  created_at  timestamptz not null default now()
);
create index status_events_editor_idx on public.status_events (editor_id, created_at);

-- End-of-shift report, required when stopping work.
create table public.shift_reports (
  id            uuid primary key default gen_random_uuid(),
  shift_id      uuid not null unique references public.shifts (id) on delete cascade,
  editor_id     uuid not null references public.editors (id) on delete cascade,
  task_id       uuid references public.tasks (id) on delete set null,
  work_done     text not null,
  blockers      text,
  progress_pct  smallint check (progress_pct between 0 and 100),
  created_at    timestamptz not null default now()
);

alter table public.editors
  add constraint editors_current_task_fkey
    foreign key (current_task_id) references public.tasks (id) on delete set null,
  add constraint editors_current_shift_fkey
    foreign key (current_shift_id) references public.shifts (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Announcements, ideas, meetings, SOPs
-- -----------------------------------------------------------------------------

create table public.meetings (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  starts_at         timestamptz not null,
  duration_minutes  integer not null default 30 check (duration_minutes > 0),
  meeting_url       text,
  agenda            text,
  created_by        uuid references public.profiles (id) on delete set null,
  reminder_sent_at  timestamptz,
  created_at        timestamptz not null default now()
);
create index meetings_starts_idx on public.meetings (starts_at);

create table public.meeting_rsvps (
  meeting_id    uuid not null references public.meetings (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  status        public.rsvp_status not null,
  responded_at  timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references public.profiles (id) on delete set null,
  title       text not null,
  body        text not null default '',
  is_pinned   boolean not null default false,
  meeting_id  uuid unique references public.meetings (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index announcements_created_idx on public.announcements (is_pinned desc, created_at desc);

create table public.announcement_comments (
  id               uuid primary key default gen_random_uuid(),
  announcement_id  uuid not null references public.announcements (id) on delete cascade,
  author_id        uuid not null references public.profiles (id) on delete cascade,
  body             text not null,
  created_at       timestamptz not null default now()
);
create index announcement_comments_idx on public.announcement_comments (announcement_id, created_at);

create table public.announcement_reactions (
  announcement_id  uuid not null references public.announcements (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  emoji            text not null check (char_length(emoji) <= 16),
  created_at       timestamptz not null default now(),
  primary key (announcement_id, user_id, emoji)
);

create table public.ideas (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references public.profiles (id) on delete set null,
  title       text not null,
  body        text,
  status      text not null default 'open' check (status in ('open', 'converted', 'archived')),
  task_id     uuid references public.tasks (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.tasks
  add constraint tasks_idea_fkey foreign key (idea_id) references public.ideas (id) on delete set null;

create table public.sops (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      public.sop_category not null,
  content       jsonb not null default '{}',                -- rich-text document (Tiptap JSON)
  is_required   boolean not null default false,             -- required for editor onboarding
  is_published  boolean not null default true,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.sop_acknowledgments (
  sop_id           uuid not null references public.sops (id) on delete cascade,
  editor_id        uuid not null references public.editors (id) on delete cascade,
  acknowledged_at  timestamptz not null default now(),
  primary key (sop_id, editor_id)
);

-- -----------------------------------------------------------------------------
-- Notifications & activity
-- -----------------------------------------------------------------------------

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  type         public.notification_type not null,
  title        text not null,
  body         text,
  link         text,                                        -- in-app path, e.g. /tasks/<id>
  entity_type  text,
  entity_id    uuid,
  read_at      timestamptz,
  emailed_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.activity_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete set null,  -- null = public form / system
  action       text not null,                               -- e.g. task.status_changed
  entity_type  text,
  entity_id    uuid,
  summary      text not null,                               -- human-readable line for the feed
  meta         jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);
