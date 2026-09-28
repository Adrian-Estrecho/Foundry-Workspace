-- =============================================================================
-- Foundry · 0003 · Access control
--
-- Model:
--   * Admins can do everything (one "admin full access" policy per table).
--   * Editors get narrow, additive policies: their own tasks, projects,
--     attendance and onboarding, plus the shared announcement/SOP spaces.
--   * Anonymous visitors get nothing. The public intake and application
--     forms write through server actions that use the service role.
--   * Attendance rows are read-only to editors; the attendance functions
--     (security definer) are the only write path.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enable RLS on every table
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'app_settings', 'leads', 'clients', 'client_checklist_items',
    'applicants', 'editors', 'editor_documents', 'editor_payment_details',
    'editor_checklist_items', 'projects', 'project_editors', 'tasks', 'subtasks',
    'task_attachments', 'task_comments', 'shifts', 'time_logs', 'status_events',
    'shift_reports', 'meetings', 'meeting_rsvps', 'announcements',
    'announcement_comments', 'announcement_reactions', 'ideas', 'sops',
    'sop_acknowledgments', 'notifications', 'activity_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin: full access (every table except notifications, which stay personal)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'app_settings', 'leads', 'clients', 'client_checklist_items',
    'applicants', 'editors', 'editor_documents', 'editor_payment_details',
    'editor_checklist_items', 'projects', 'project_editors', 'tasks', 'subtasks',
    'task_attachments', 'task_comments', 'shifts', 'time_logs', 'status_events',
    'shift_reports', 'meetings', 'meeting_rsvps', 'announcements',
    'announcement_comments', 'announcement_reactions', 'ideas', 'sops',
    'sop_acknowledgments', 'activity_log'
  ] loop
    execute format(
      'create policy "admin full access" on public.%I
         for all to authenticated
         using ((select public.is_admin()))
         with check ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles & settings
-- -----------------------------------------------------------------------------
-- Names and avatars are needed across the app (comments, mentions, feeds).
create policy "signed-in users read profiles" on public.profiles
  for select to authenticated using (true);

-- Role/email changes are blocked by the guard_profile_changes trigger.
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "signed-in users read settings" on public.app_settings
  for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- Editors: own record, documents, payment details, onboarding
-- -----------------------------------------------------------------------------
create policy "editors read own record" on public.editors
  for select to authenticated using (id = (select auth.uid()));

create policy "editors read own documents" on public.editor_documents
  for select to authenticated using (editor_id = (select auth.uid()));
create policy "editors add own documents" on public.editor_documents
  for insert to authenticated with check (editor_id = (select auth.uid()));
create policy "editors remove own documents" on public.editor_documents
  for delete to authenticated using (editor_id = (select auth.uid()));

create policy "editors read own payment details" on public.editor_payment_details
  for select to authenticated using (editor_id = (select auth.uid()));
create policy "editors add own payment details" on public.editor_payment_details
  for insert to authenticated with check (editor_id = (select auth.uid()));
create policy "editors update own payment details" on public.editor_payment_details
  for update to authenticated
  using (editor_id = (select auth.uid()))
  with check (editor_id = (select auth.uid()));

create policy "editors read own checklist" on public.editor_checklist_items
  for select to authenticated using (editor_id = (select auth.uid()));
create policy "editors tick own checklist" on public.editor_checklist_items
  for update to authenticated
  using (editor_id = (select auth.uid()))
  with check (editor_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Projects & tasks
-- -----------------------------------------------------------------------------
create policy "editors read their projects" on public.projects
  for select to authenticated using (public.is_project_member(id));

create policy "editors read own project memberships" on public.project_editors
  for select to authenticated using (editor_id = (select auth.uid()));

create policy "editors read assigned tasks" on public.tasks
  for select to authenticated using (assignee_id = (select auth.uid()));

-- Which columns and statuses an editor may change is enforced by the
-- guard_task_changes trigger.
create policy "editors update assigned tasks" on public.tasks
  for update to authenticated
  using (assignee_id = (select auth.uid()))
  with check (assignee_id = (select auth.uid()));

create policy "editors manage subtasks on assigned tasks" on public.subtasks
  for all to authenticated
  using (public.is_task_assignee(task_id))
  with check (public.is_task_assignee(task_id));

create policy "editors read attachments on assigned tasks" on public.task_attachments
  for select to authenticated using (public.is_task_assignee(task_id));
create policy "editors add attachments to assigned tasks" on public.task_attachments
  for insert to authenticated
  with check (public.is_task_assignee(task_id) and added_by = (select auth.uid()));
create policy "editors remove own attachments" on public.task_attachments
  for delete to authenticated using (added_by = (select auth.uid()));

create policy "editors read comments on assigned tasks" on public.task_comments
  for select to authenticated using (public.is_task_assignee(task_id));
create policy "editors comment on assigned tasks" on public.task_comments
  for insert to authenticated
  with check (public.is_task_assignee(task_id) and author_id = (select auth.uid()));
create policy "authors edit own comments" on public.task_comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "authors delete own comments" on public.task_comments
  for delete to authenticated using (author_id = (select auth.uid()));

-- Editors see client names for their projects, but not contact details,
-- contracts or payment status. The view runs as its owner and filters itself.
create view public.client_directory
with (security_invoker = false) as
  select c.id, c.company, c.contact_name
  from public.clients c
  where (select public.is_admin())
     or exists (
       select 1 from public.projects p
       where p.client_id = c.id and public.is_project_member(p.id)
     );

revoke all on public.client_directory from anon;
grant select on public.client_directory to authenticated;

-- -----------------------------------------------------------------------------
-- Attendance (read-only for editors)
-- -----------------------------------------------------------------------------
create policy "editors read own shifts" on public.shifts
  for select to authenticated using (editor_id = (select auth.uid()));
create policy "editors read own time logs" on public.time_logs
  for select to authenticated using (editor_id = (select auth.uid()));
create policy "editors read own status events" on public.status_events
  for select to authenticated using (editor_id = (select auth.uid()));
create policy "editors read own shift reports" on public.shift_reports
  for select to authenticated using (editor_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Announcements, ideas, meetings, SOPs (shared spaces)
-- -----------------------------------------------------------------------------
create policy "signed-in users read announcements" on public.announcements
  for select to authenticated using (true);

create policy "signed-in users read announcement comments" on public.announcement_comments
  for select to authenticated using (true);
create policy "users comment as themselves" on public.announcement_comments
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "authors edit own announcement comments" on public.announcement_comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "authors delete own announcement comments" on public.announcement_comments
  for delete to authenticated using (author_id = (select auth.uid()));

create policy "signed-in users read reactions" on public.announcement_reactions
  for select to authenticated using (true);
create policy "users react as themselves" on public.announcement_reactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users remove own reactions" on public.announcement_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "signed-in users read ideas" on public.ideas
  for select to authenticated using (true);
create policy "users post ideas as themselves" on public.ideas
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "authors edit own ideas" on public.ideas
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "authors delete own ideas" on public.ideas
  for delete to authenticated using (author_id = (select auth.uid()));

create policy "signed-in users read meetings" on public.meetings
  for select to authenticated using (true);

create policy "signed-in users read rsvps" on public.meeting_rsvps
  for select to authenticated using (true);
create policy "users rsvp as themselves" on public.meeting_rsvps
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users change own rsvp" on public.meeting_rsvps
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "users withdraw own rsvp" on public.meeting_rsvps
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "editors read published sops" on public.sops
  for select to authenticated using (is_published);

create policy "editors read own acknowledgments" on public.sop_acknowledgments
  for select to authenticated using (editor_id = (select auth.uid()));
create policy "editors acknowledge sops" on public.sop_acknowledgments
  for insert to authenticated with check (editor_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Notifications: always personal, admins included. Rows are created by
-- triggers and server code, never directly by clients.
-- -----------------------------------------------------------------------------
create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users mark own notifications" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "users clear own notifications" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Storage
--   avatars      public read; users write inside <user_id>/
--   contracts    admin only (client contracts)
--   editor-docs  admin + the editor, inside <editor_id>/
--   task-files   admin + the task's assignee, inside <task_id>/
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('avatars',     'avatars',     true,  2097152),     -- 2 MB
  ('contracts',   'contracts',   false, 26214400),    -- 25 MB
  ('editor-docs', 'editor-docs', false, 26214400),    -- 25 MB
  ('task-files',  'task-files',  false, 104857600)    -- 100 MB
on conflict (id) do nothing;

-- Folder names are user-controlled, so parse them without throwing.
create or replace function public.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

create policy "users manage own avatar" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "admins manage private files" on storage.objects
  for all to authenticated
  using (bucket_id in ('contracts', 'editor-docs', 'task-files') and (select public.is_admin()))
  with check (bucket_id in ('contracts', 'editor-docs', 'task-files') and (select public.is_admin()));

create policy "editors read own documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'editor-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "editors upload own documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'editor-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "editors delete own documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'editor-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "assignees read task files" on storage.objects
  for select to authenticated
  using (bucket_id = 'task-files'
         and public.is_task_assignee(public.try_uuid((storage.foldername(name))[1])));
create policy "assignees upload task files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-files'
              and public.is_task_assignee(public.try_uuid((storage.foldername(name))[1])));

-- -----------------------------------------------------------------------------
-- Realtime: the private "presence:team" channel that powers Online/Offline.
-- Guarded because realtime.messages is created by the Realtime service.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute $p$
      create policy "team presence: listen" on realtime.messages
        for select to authenticated
        using ((select realtime.topic()) = 'presence:team')
    $p$;
    execute $p$
      create policy "team presence: track" on realtime.messages
        for insert to authenticated
        with check ((select realtime.topic()) = 'presence:team')
    $p$;
  else
    raise warning 'realtime.messages not found: presence policies not created';
  end if;
end;
$$;
