-- =============================================================================
-- Foundry · 0006 · Projects & tasks (Phase 4)
--   * Editors can't reopen a task once an admin has marked it Done
--   * Assigning a task on a project adds the editor to the project team
--   * Every task notifies the other side: assigned, ready for review,
--     revisions requested (this replaces the trial-only notifications)
--   * @mentions in task comments notify the people mentioned
--   * Task and project changes show up in the activity feed
--   * Time logged per task and per project
--   * Editors see their teammates on shared projects, and can remove the
--     task files they uploaded
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Labels
-- -----------------------------------------------------------------------------
create or replace function public.task_status_label(p_status public.task_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'todo'        then 'To Do'
    when 'in_progress' then 'In Progress'
    when 'for_review'  then 'For Review'
    when 'revisions'   then 'Revisions'
    when 'done'        then 'Done'
  end;
$$;

create or replace function public.project_status_label(p_status public.project_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'brief_received'  then 'Brief Received'
    when 'in_progress'     then 'In Progress'
    when 'internal_review' then 'Internal Review'
    when 'client_review'   then 'Client Review'
    when 'revisions'       then 'Revisions'
    when 'delivered'       then 'Delivered'
  end;
$$;

-- -----------------------------------------------------------------------------
-- Task invariants (replaces the Phase 1 version)
--   * Editors may move their tasks between To Do / In Progress / For Review
--     and update progress, but only an admin can mark Done, request
--     Revisions, reopen a Done task, or change what the task is.
--   * Entering Revisions bumps revision_count; Done stamps completed_at.
-- -----------------------------------------------------------------------------
create or replace function public.guard_task_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (select auth.uid()) is not null and not public.is_admin() then
    if new.project_id     is distinct from old.project_id
    or new.assignee_id    is distinct from old.assignee_id
    or new.title          is distinct from old.title
    or new.description    is distinct from old.description
    or new.due_date       is distinct from old.due_date
    or new.priority       is distinct from old.priority
    or new.revision_count is distinct from old.revision_count
    or new.is_trial       is distinct from old.is_trial
    or new.idea_id        is distinct from old.idea_id
    or new.created_by     is distinct from old.created_by then
      raise exception 'Editors can only change the status and progress of their tasks.'
        using errcode = '42501';
    end if;

    if new.status is distinct from old.status then
      if old.status = 'done' then
        raise exception 'This task is done. Ask an admin to reopen it.' using errcode = '42501';
      end if;
      if new.status in ('done', 'revisions') then
        raise exception 'Only an admin can move a task to %.', public.task_status_label(new.status)
          using errcode = '42501';
      end if;
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

-- -----------------------------------------------------------------------------
-- Project team follows task assignment
-- An editor given a task on a project joins that project's team, so they see
-- the project, its specs and links. (This also ticks "Editor assigned" on the
-- client's onboarding checklist through on_project_editor_added.)
-- -----------------------------------------------------------------------------
create or replace function public.add_assignee_to_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_editors (project_id, editor_id)
  values (new.project_id, new.assignee_id)
  on conflict do nothing;
  return null;
end;
$$;

create trigger add_assignee_to_project
  after insert or update of assignee_id, project_id on public.tasks
  for each row
  when (new.project_id is not null and new.assignee_id is not null)
  execute function public.add_assignee_to_project();

-- -----------------------------------------------------------------------------
-- Task notifications (replaces notify_trial_task from 0005)
--   assigned            → the editor (unless they assigned it themselves)
--   moved to For Review → every admin except whoever moved it
--   Revisions requested → the editor, with the latest feedback when there is one
-- Trial tasks keep their onboarding wording and links.
-- -----------------------------------------------------------------------------
drop trigger notify_trial_task on public.tasks;
drop function public.notify_trial_task();

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
    insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
    values (
      new.assignee_id, 'task_assigned',
      case when new.is_trial then 'Your trial task: ' else 'New task: ' end || new.title,
      nullif(concat_ws(' · ', v_project, 'Due ' || to_char(new.due_date, 'Mon FMDD')), ''),
      v_editor_link, 'task', new.id
    );
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'for_review' then
      insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
      select p.id, 'task_for_review',
             case when new.is_trial then 'Trial task ready: ' || v_editor else 'Ready for review: ' || new.title end,
             case when new.is_trial then new.title else concat_ws(' · ', v_editor, v_project) end,
             case when new.is_trial then '/editors/' || new.assignee_id else '/tasks/' || new.id end,
             'task', new.id
      from public.profiles p
      where p.role = 'admin' and p.id is distinct from v_actor;

    elsif new.status = 'revisions' and new.assignee_id is distinct from v_actor then
      -- Feedback is posted as a comment just before the status change.
      select left(c.body, 160) into v_feedback
      from public.task_comments c
      where c.task_id = new.id
        and c.author_id is not distinct from v_actor
        and c.created_at > now() - interval '5 minutes'
      order by c.created_at desc
      limit 1;

      insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
      values (
        new.assignee_id, 'revision_requested', 'Revisions requested: ' || new.title,
        case when new.is_trial then 'See the feedback on your onboarding page'
             else coalesce(v_feedback, 'See the feedback on the task') end,
        v_editor_link, 'task', new.id
      );
    end if;
  end if;

  return null;
end;
$$;

create trigger notify_task_changes
  after insert or update of status, assignee_id on public.tasks
  for each row execute function public.notify_task_changes();

-- -----------------------------------------------------------------------------
-- @mentions in task comments
-- Only people who can open the task are notified: admins and the assignee.
-- -----------------------------------------------------------------------------
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

  insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
  select p.id, 'mention',
         v_author || ' mentioned you on ' || v_task.title,
         left(new.body, 160),
         case
           when not v_task.is_trial then '/tasks/' || v_task.id
           when p.role = 'admin' then '/editors/' || v_task.assignee_id
           else '/onboarding'
         end,
         'task', v_task.id
  from public.profiles p
  where p.id = any (new.mentions)
    and p.id <> new.author_id
    and (p.role = 'admin' or p.id = v_task.assignee_id);

  return null;
end;
$$;

create trigger notify_task_mentions
  after insert on public.task_comments
  for each row execute function public.notify_task_mentions();

-- -----------------------------------------------------------------------------
-- Activity feed: tasks
-- -----------------------------------------------------------------------------
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
    -- Trial tasks are logged by the onboarding flow.
    if not new.is_trial then
      insert into public.activity_log (actor_id, action, entity_type, entity_id, summary)
      values (v_actor, 'task.created', 'task', new.id,
              'New task: ' || new.title || coalesce(' for ' || v_editor, ''));
    end if;
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.activity_log (actor_id, action, entity_type, entity_id, summary, meta)
    values (v_actor, 'task.status_changed', 'task', new.id,
            case when v_actor_name is null then new.title || ' moved to '
                 else v_actor_name || ' moved ' || new.title || ' to ' end
            || public.task_status_label(new.status),
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.activity_log (actor_id, action, entity_type, entity_id, summary, meta)
    values (v_actor, 'task.reassigned', 'task', new.id,
            case when v_editor is null then new.title || ' is now unassigned'
                 else new.title || ' reassigned to ' || v_editor end,
            jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
  end if;

  return null;
end;
$$;

create trigger log_task_activity
  after insert or update of status, assignee_id on public.tasks
  for each row execute function public.log_task_activity();

-- -----------------------------------------------------------------------------
-- Projects: delivered_at bookkeeping and activity feed
-- -----------------------------------------------------------------------------
create or replace function public.touch_project_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'delivered' then
    if tg_op = 'INSERT' or old.status <> 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
    end if;
  else
    new.delivered_at := null;
  end if;
  return new;
end;
$$;

create trigger touch_project_status
  before insert or update of status on public.projects
  for each row execute function public.touch_project_status();

create or replace function public.log_project_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_log (actor_id, action, entity_type, entity_id, summary, meta)
  values ((select auth.uid()), 'project.status_changed', 'project', new.id,
          new.name || ' moved to ' || public.project_status_label(new.status),
          jsonb_build_object('from', old.status, 'to', new.status));
  return null;
end;
$$;

create trigger log_project_status
  after update of status on public.projects
  for each row
  when (new.status is distinct from old.status)
  execute function public.log_project_status();

-- -----------------------------------------------------------------------------
-- Time logged. Security invoker: RLS applies, so an admin sees everyone's
-- time and an editor sees their own. Open logs count up to now.
-- -----------------------------------------------------------------------------
create or replace function public.task_time(p_task_id uuid)
returns table (editor_id uuid, seconds bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.editor_id,
    coalesce(sum(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at))), 0)::bigint
  from public.time_logs t
  where t.task_id = p_task_id
  group by t.editor_id;
$$;

create or replace function public.project_time(p_project_id uuid)
returns table (editor_id uuid, seconds bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.editor_id,
    coalesce(sum(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at))), 0)::bigint
  from public.time_logs t
  join public.tasks k on k.id = t.task_id
  where k.project_id = p_project_id
  group by t.editor_id;
$$;

-- -----------------------------------------------------------------------------
-- Access
-- -----------------------------------------------------------------------------

-- Editors see who else is on their projects.
create policy "editors read teammates on their projects" on public.project_editors
  for select to authenticated using (public.is_project_member(project_id));

-- Assignees can remove task files they uploaded themselves.
create policy "assignees delete own task files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'task-files'
         and owner_id = (select auth.uid())::text
         and public.is_task_assignee(public.try_uuid((storage.foldername(name))[1])));

-- -----------------------------------------------------------------------------
-- Realtime: task pages refresh live
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.subtasks,
  public.task_comments,
  public.task_attachments,
  public.project_editors;
