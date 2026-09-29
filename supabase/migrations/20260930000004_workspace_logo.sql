-- =============================================================================
-- Foundry · Workspace logo
--   * A workspace can have a logo. It shows in the sidebar switcher, on the
--     public application and project forms, and on the client portal.
--   * Logos live in the public workspace-logos bucket, inside
--     <workspace_id>/. Anyone can view them (they're on public pages); only
--     the workspace's owners and admins can add, replace or remove them.
--     Each upload gets a new file name, so a replaced logo never shows
--     stale from a cache.
-- =============================================================================

alter table public.workspaces
  add column logo_path text check (logo_path is null or logo_path like id::text || '/%');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workspace-logos', 'workspace-logos', true, 2097152,             -- 2 MB
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "admins manage workspace logo" on storage.objects
  for all to authenticated
  using (bucket_id = 'workspace-logos' and (select public.is_admin())
         and (storage.foldername(name))[1] = (select public.current_workspace_id())::text)
  with check (bucket_id = 'workspace-logos' and (select public.is_admin())
              and (storage.foldername(name))[1] = (select public.current_workspace_id())::text);

-- Public pages show the logo too, so branding returns it.
drop function public.public_branding(text);

create function public.public_branding(p_slug text)
returns table (workspace_id uuid, name text, default_accent text, accepting_applications boolean, logo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select id, name, default_accent, accepting_applications, logo_path
  from public.workspaces
  where slug = lower(p_slug);
$$;

grant execute on function public.public_branding(text) to anon, authenticated;
