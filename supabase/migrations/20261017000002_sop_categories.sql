-- =============================================================================
-- SOP categories of the workspace's own, in place of the four built-in ones.
--
-- Every workspace starts with the four it had (Editing workflow, Frame.io
-- review, File naming & delivery, Communication). People who write SOPs add,
-- rename, reorder and remove them. Removing one moves its SOPs to another
-- (delete_sop_category); a workspace keeps at least one.
--
-- sops.category (the old enum) stays for now so the app running during a
-- deploy keeps working; nothing reads it after this. A later migration drops it.
-- =============================================================================

create table public.sop_categories (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null default public.current_workspace_id()
                  references public.workspaces (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60 and name = btrim(name)),
  position      double precision not null default 0,
  created_at    timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index sop_categories_name_key on public.sop_categories (workspace_id, lower(name));
create index sop_categories_position_idx on public.sop_categories (workspace_id, position);

create trigger set_workspace_id before update on public.sop_categories
  for each row execute function public.set_workspace_id();

-- Everyone in the workspace reads them; people who write SOPs add and edit
-- them. No delete policy: removing goes through delete_sop_category().
alter table public.sop_categories enable row level security;
create policy "current workspace only" on public.sop_categories
  as restrictive for all to authenticated
  using (workspace_id = (select public.current_workspace_id()))
  with check (workspace_id = (select public.current_workspace_id()));
create policy "members read sop categories" on public.sop_categories
  for select to authenticated using (true);
create policy "sop writers add categories" on public.sop_categories
  for insert to authenticated with check ((select public.has_permission('sops.manage')));
create policy "sop writers edit categories" on public.sop_categories
  for update to authenticated
  using ((select public.has_permission('sops.manage')))
  with check ((select public.has_permission('sops.manage')));

-- -----------------------------------------------------------------------------
-- The defaults, for every new workspace and every existing one
-- -----------------------------------------------------------------------------
create or replace function public.seed_sop_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sop_categories (workspace_id, name, position)
  values
    (new.id, 'Editing workflow',       1),
    (new.id, 'Frame.io review',        2),
    (new.id, 'File naming & delivery', 3),
    (new.id, 'Communication',          4);
  return null;
end;
$$;

create trigger seed_sop_categories after insert on public.workspaces
  for each row execute function public.seed_sop_categories();

insert into public.sop_categories (workspace_id, name, position)
select w.id, d.name, d.position
from public.workspaces w
cross join (values
  ('Editing workflow',       1),
  ('Frame.io review',        2),
  ('File naming & delivery', 3),
  ('Communication',          4)
) as d (name, position);

-- -----------------------------------------------------------------------------
-- sops.category_id, in the SOP's own workspace (the pair is the key). CHECK
-- rather than NOT NULL keeps it optional in the generated insert types: a
-- trigger fills it in when it's left out.
-- -----------------------------------------------------------------------------
alter table public.sops
  add column category_id uuid,
  add constraint sops_category_fkey foreign key (workspace_id, category_id)
    references public.sop_categories (workspace_id, id);

-- The old category's name, for SOPs written before this (and the seed).
create or replace function public.legacy_sop_category_name(p_category public.sop_category)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'editing_workflow' then 'Editing workflow'
    when 'frameio_review' then 'Frame.io review'
    when 'file_naming_delivery' then 'File naming & delivery'
    when 'communication' then 'Communication'
  end;
$$;

-- Filing them isn't an edit: keep each SOP's "updated" date.
alter table public.sops disable trigger set_updated_at;
update public.sops s
   set category_id = c.id
  from public.sop_categories c
 where c.workspace_id = s.workspace_id
   and c.name = public.legacy_sop_category_name(s.category);
alter table public.sops enable trigger set_updated_at;

alter table public.sops add constraint sops_category_set check (category_id is not null);
alter table public.sops alter column category set default 'editing_workflow';
create index sops_category_idx on public.sops (workspace_id, category_id);

-- Left out on insert: the category named like the old one, else the first.
create or replace function public.default_sop_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category_id is null then
    select c.id into new.category_id
    from public.sop_categories c
    where c.workspace_id = new.workspace_id
    order by lower(c.name) = lower(public.legacy_sop_category_name(new.category)) desc nulls last, c.position
    limit 1;
  end if;
  return new;
end;
$$;

create trigger default_sop_category before insert on public.sops
  for each row execute function public.default_sop_category();

-- -----------------------------------------------------------------------------
-- Order and removal
-- -----------------------------------------------------------------------------
create or replace function public.reorder_sop_categories(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('sops.manage') then
    raise exception 'Only people who write SOPs can change the categories.' using errcode = '42501';
  end if;
  update public.sop_categories c
     set position = o.ordinality
    from unnest(p_ids) with ordinality as o (id, ordinality)
   where c.id = o.id
     and c.workspace_id = public.current_workspace_id();
end;
$$;

-- Removes a category; its SOPs move to p_move_to first.
create or replace function public.delete_sop_category(p_id uuid, p_move_to uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := public.current_workspace_id();
begin
  if not public.has_permission('sops.manage') then
    raise exception 'Only people who write SOPs can change the categories.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.sop_categories where id = p_id and workspace_id = v_workspace_id) then
    raise exception 'That category isn''t there any more.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.sop_categories where workspace_id = v_workspace_id and id <> p_id) then
    raise exception 'Keep at least one category.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.sops where category_id = p_id) then
    if p_move_to is null or p_move_to = p_id
       or not exists (select 1 from public.sop_categories where id = p_move_to and workspace_id = v_workspace_id) then
      raise exception 'Choose where its SOPs go.' using errcode = 'P0001';
    end if;
    update public.sops set category_id = p_move_to where category_id = p_id;
  end if;
  delete from public.sop_categories where id = p_id;
end;
$$;

revoke all on function public.reorder_sop_categories(uuid[]) from public, anon;
grant execute on function public.reorder_sop_categories(uuid[]) to authenticated;
revoke all on function public.delete_sop_category(uuid, uuid) from public, anon;
grant execute on function public.delete_sop_category(uuid, uuid) to authenticated;
revoke all on function public.seed_sop_categories() from public, anon, authenticated;
revoke all on function public.default_sop_category() from public, anon, authenticated;

alter publication supabase_realtime add table public.sop_categories;
