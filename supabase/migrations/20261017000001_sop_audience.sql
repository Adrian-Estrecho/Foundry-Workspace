-- =============================================================================
-- SOPs: who can see each one.
--
-- Two groups, plus named people:
--   - "Admins & managers": owners, admins, and active editors given any extra
--     ability on the People page (a project manager, operational control…).
--   - "Editors": everyone else, people still onboarding included.
-- An SOP is open to either group, both (everyone, the default), and/or the
-- people in shared_with. People who can write SOPs (sops.manage) see every SOP
-- whatever it says: the existing admin and "delegated: manage sops" policies.
-- Required reading, onboarding included, only asks people who can see it.
-- =============================================================================

alter table public.sops
  add column visible_to_admins boolean not null default true,
  add column visible_to_editors boolean not null default true,
  add column shared_with uuid[] not null default '{}';

comment on column public.sops.visible_to_admins is 'Everyone in "Admins & managers": owners, admins, editors with any extra ability.';
comment on column public.sops.visible_to_editors is 'Everyone in "Editors": editors without extra abilities, onboarding ones included.';
comment on column public.sops.shared_with is 'Members who can see it whatever their group (user ids).';

-- Whether a member of the SOP's workspace may read it (published or not is the caller's concern).
create or replace function public.can_read_sop(p_sop_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sops s
    join public.workspace_members m on m.workspace_id = s.workspace_id and m.user_id = p_user_id
    where s.id = p_sop_id
      and m.status in ('onboarding', 'active')
      and (
        p_user_id = any (s.shared_with)
        or case
             when m.role in ('owner', 'admin') or (m.status = 'active' and cardinality(m.permissions) > 0)
               then s.visible_to_admins
             else s.visible_to_editors
           end
      )
  );
$$;

drop policy "editors read published sops" on public.sops;
create policy "members read published sops shared with them" on public.sops
  for select to authenticated
  using (is_published and public.can_read_sop(id, (select auth.uid())));

-- Only an SOP you can see can be marked as read.
drop policy "editors acknowledge sops" on public.sop_acknowledgments;
create policy "editors acknowledge sops" on public.sop_acknowledgments
  for insert to authenticated
  with check (editor_id = (select auth.uid()) and public.can_read_sop(sop_id, (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Onboarding: "Read required SOPs" counts only the ones the editor can see.
-- (As in 20260929000005_onboarding_gate, but for that one condition.)
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
      and public.can_read_sop(s.id, p_editor_id)
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

-- An SOP taken off someone's list (hidden, unpublished, no longer required or
-- deleted) can finish their reading: check everyone still onboarding.
create or replace function public.on_sop_audience_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := coalesce(new.workspace_id, old.workspace_id);
  v_editor_id uuid;
begin
  for v_editor_id in
    select m.user_id from public.workspace_members m
    where m.workspace_id = v_workspace_id and m.role = 'editor' and m.status = 'onboarding'
  loop
    perform public.sync_editor_checklist(v_workspace_id, v_editor_id);
  end loop;
  return null;
end;
$$;

revoke all on function public.on_sop_audience_changed() from public, anon, authenticated;

create trigger sop_audience_changed
  after update of is_required, is_published, visible_to_admins, visible_to_editors, shared_with or delete
  on public.sops
  for each row execute function public.on_sop_audience_changed();
