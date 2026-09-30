-- =============================================================================
-- Removing an inactive editor
--
-- Someone who manages editors can remove an editor who was marked inactive.
-- Their membership becomes 'left', so they drop out of the Editors list,
-- People, Messages and every picker, and lose access to the workspace. Their
-- history stays: shifts, hours, tasks they worked on, their message thread.
-- A new invitation brings them back (add_editor_member reopens 'left').
-- =============================================================================

create or replace function public.remove_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (select public.current_workspace_id());
  v_member public.workspace_members;
  v_active boolean;
  v_open integer;
  v_shift uuid;
  v_name text;
begin
  if not (select public.has_permission('editors.manage')) then
    raise exception 'Only an admin can remove editors.' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'not_self' using errcode = 'P0001';
  end if;

  select * into v_member from public.workspace_members
  where workspace_id = v_workspace_id and user_id = p_user_id
  for update;
  select is_active into v_active from public.editors
  where workspace_id = v_workspace_id and id = p_user_id
  for update;
  if v_member.user_id is null or v_active is null or v_member.status <> 'active' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_member.role <> 'editor' then
    raise exception 'not_editor' using errcode = 'P0001';
  end if;
  if v_active then
    raise exception 'still_active' using errcode = 'P0001';
  end if;

  -- Work in progress needs a new owner first, or it would sit with nobody.
  select count(*) into v_open from public.tasks
  where workspace_id = v_workspace_id and assignee_id = p_user_id and status <> 'done' and not is_trial;
  if v_open > 0 then
    raise exception 'open_tasks' using errcode = 'P0001', detail = v_open::text;
  end if;

  -- A shift left running would also stop them working anywhere else.
  select id into v_shift from public.shifts
  where workspace_id = v_workspace_id and editor_id = p_user_id and clock_out_at is null;
  if v_shift is not null then
    perform public.close_shift(v_shift, now(), 'admin');
  end if;

  perform set_config('foundry.membership_change', 'on', true);
  update public.workspace_members
     set status = 'left', permissions = '{}', title = null
   where workspace_id = v_workspace_id and user_id = p_user_id;
  perform set_config('foundry.membership_change', 'off', true);

  delete from public.project_editors where workspace_id = v_workspace_id and editor_id = p_user_id;

  select full_name into v_name from public.profiles where id = p_user_id;
  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
  values (v_workspace_id, (select auth.uid()), 'editor.removed', 'editor', p_user_id,
          v_name || ' was removed from the team');
end;
$$;

revoke all on function public.remove_member(uuid) from public, anon;
grant execute on function public.remove_member(uuid) to authenticated;
