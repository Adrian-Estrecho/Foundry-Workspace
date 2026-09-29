-- =============================================================================
-- Foundry · 0013 · Messages, announcements and the client portal (Phase 6)
--   * Private threads: one per editor (the editor and the workspace's
--     admins) and one per client (the client and the admins). Admins see
--     every thread; an editor sees only their own. Threads are created with
--     their first message.
--   * Messages are written only through post_message() (signed-in people)
--     and post_client_message() (the client portal, via the server).
--   * A new message notifies the other side. Unread message notifications
--     are kept to one per thread and person, refreshed by each new message.
--   * Announcements notify the team; reading them clears the badge.
--   * Client portal: a private link per client (no login) to follow their
--     projects' tasks and message the team. The server reads it with the
--     service role after checking the link.
-- =============================================================================

create type public.message_thread_kind as enum ('editor', 'client');
create type public.message_sender as enum ('admin', 'editor', 'client');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.message_threads (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null default public.current_workspace_id()
                          references public.workspaces (id) on delete cascade,
  kind                  public.message_thread_kind not null,
  editor_id             uuid,
  client_id             uuid references public.clients (id) on delete cascade,
  last_message_at       timestamptz,
  last_message_preview  text,
  last_sender           public.message_sender,
  -- The client's side: when they last opened the portal, and when we last
  -- emailed them about a reply (replies close together share one email).
  client_last_read_at   timestamptz,
  client_emailed_at     timestamptz,
  created_at            timestamptz not null default now(),
  foreign key (workspace_id, editor_id) references public.editors (workspace_id, id) on delete cascade,
  check ((kind = 'editor') = (editor_id is not null) and (kind = 'client') = (client_id is not null))
);
create unique index message_threads_editor_key on public.message_threads (workspace_id, editor_id) where kind = 'editor';
create unique index message_threads_client_key on public.message_threads (client_id) where kind = 'client';
create index message_threads_recent_idx on public.message_threads (workspace_id, kind, last_message_at desc nulls last);

create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null default public.current_workspace_id()
                  references public.workspaces (id) on delete cascade,
  thread_id     uuid not null references public.message_threads (id) on delete cascade,
  sender        public.message_sender not null,
  author_id     uuid references public.profiles (id) on delete set null,   -- null when the client wrote it
  body          text not null check (char_length(body) between 1 and 4000),
  created_at    timestamptz not null default now()
);
create index messages_thread_idx on public.messages (thread_id, created_at desc);
create index messages_workspace_idx on public.messages (workspace_id);

-- How far each person has read each thread.
create table public.message_reads (
  thread_id     uuid not null references public.message_threads (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  workspace_id  uuid not null default public.current_workspace_id()
                  references public.workspaces (id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index message_reads_user_idx on public.message_reads (user_id);

-- One private portal link per client.
create table public.client_portals (
  client_id       uuid primary key references public.clients (id) on delete cascade,
  workspace_id    uuid not null default public.current_workspace_id()
                    references public.workspaces (id) on delete cascade,
  token           text not null unique check (token ~ '^[A-Za-z0-9_-]{32,64}$'),
  enabled         boolean not null default true,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  last_viewed_at  timestamptz
);

-- Children follow their parent's workspace; nothing moves workspace.
create trigger set_workspace_id before insert or update on public.message_threads
  for each row execute function public.set_workspace_id('clients', 'client_id');
create trigger set_workspace_id before insert or update on public.messages
  for each row execute function public.set_workspace_id('message_threads', 'thread_id');
create trigger set_workspace_id before insert or update on public.message_reads
  for each row execute function public.set_workspace_id('message_threads', 'thread_id');
create trigger set_workspace_id before insert or update on public.client_portals
  for each row execute function public.set_workspace_id('clients', 'client_id');

-- -----------------------------------------------------------------------------
-- Access
-- -----------------------------------------------------------------------------
alter table public.message_threads enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.client_portals enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['message_threads', 'messages', 'message_reads', 'client_portals'] loop
    execute format(
      'create policy "current workspace only" on public.%I
         as restrictive for all to authenticated
         using (workspace_id = (select public.current_workspace_id()))
         with check (workspace_id = (select public.current_workspace_id()))', t);
    execute format(
      'create policy "full access only" on public.%I
         as restrictive for all to authenticated
         using ((select public.is_full_member()))
         with check ((select public.is_full_member()))', t);
  end loop;
end;
$$;

-- The caller's own thread with the admins.
create or replace function public.is_own_thread(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.message_threads
    where id = p_thread_id
      and kind = 'editor'
      and editor_id = (select auth.uid())
      and workspace_id = (select public.current_workspace_id())
  );
$$;

-- Admins read every thread; writes go through the functions below.
create policy "admins read threads" on public.message_threads
  for select to authenticated using ((select public.is_admin()));
create policy "editors read own thread" on public.message_threads
  for select to authenticated using (kind = 'editor' and editor_id = (select auth.uid()));

create policy "admins read messages" on public.messages
  for select to authenticated using ((select public.is_admin()));
create policy "editors read own thread's messages" on public.messages
  for select to authenticated using (public.is_own_thread(thread_id));

create policy "users read own read receipts" on public.message_reads
  for select to authenticated using (user_id = (select auth.uid()));

create policy "admin full access" on public.client_portals
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Posting
-- -----------------------------------------------------------------------------

-- Tells people about a message. While their last message notification for
-- the thread is unread, it's refreshed instead of adding another one (and
-- only emailed again after an hour).
create or replace function public.notify_message(
  p_workspace_id uuid,
  p_thread_id uuid,
  p_user_ids uuid[],
  p_from text,
  p_body text,
  p_link text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications n
     set title = 'Message from ' || p_from,
         body = left(p_body, 160),
         link = p_link,
         created_at = now(),
         emailed_at = case when n.emailed_at < now() - interval '1 hour' then null else n.emailed_at end
   where n.user_id = any (p_user_ids)
     and n.type = 'new_message'
     and n.entity_type = 'thread'
     and n.entity_id = p_thread_id
     and n.read_at is null;

  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  select p_workspace_id, u.id, 'new_message', 'Message from ' || p_from, left(p_body, 160), p_link, 'thread', p_thread_id
  from unnest(p_user_ids) as u(id)
  where not exists (
    select 1 from public.notifications n
    where n.user_id = u.id
      and n.type = 'new_message'
      and n.entity_type = 'thread'
      and n.entity_id = p_thread_id
      and n.read_at is null
  );
end;
$$;

-- The thread for an editor or a client, created if it doesn't exist yet.
create or replace function public.thread_for(
  p_workspace_id uuid,
  p_kind public.message_thread_kind,
  p_subject_id uuid
)
returns public.message_threads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread public.message_threads;
begin
  insert into public.message_threads (workspace_id, kind, editor_id, client_id)
  values (
    p_workspace_id,
    p_kind,
    case when p_kind = 'editor' then p_subject_id end,
    case when p_kind = 'client' then p_subject_id end
  )
  on conflict do nothing;

  select * into v_thread
  from public.message_threads
  where workspace_id = p_workspace_id
    and kind = p_kind
    and case when p_kind = 'editor' then editor_id else client_id end = p_subject_id
  for update;
  return v_thread;
end;
$$;

-- Posts a message as the signed-in person. Admins write to any editor's or
-- client's thread; an editor only to their own. Returns the thread id.
create or replace function public.post_message(
  p_kind public.message_thread_kind,
  p_subject_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_workspace_id uuid := (select public.current_workspace_id());
  v_admin boolean := (select public.is_admin());
  v_body text := trim(p_body);
  v_sender public.message_sender;
  v_thread public.message_threads;
  v_name text;
  v_admins uuid[];
begin
  if v_user is null or v_workspace_id is null or not (select public.is_full_member()) then
    raise exception 'Only members of this workspace can send messages.' using errcode = '42501';
  end if;
  if v_body is null or v_body = '' then
    raise exception 'empty_message' using errcode = 'P0001';
  end if;
  if char_length(v_body) > 4000 then
    raise exception 'message_too_long' using errcode = 'P0001';
  end if;

  if p_kind = 'editor' then
    if not v_admin and p_subject_id is distinct from v_user then
      raise exception 'You can only write in your own inbox.' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.editors e
      join public.workspace_members m on m.workspace_id = e.workspace_id and m.user_id = e.id
      where e.workspace_id = v_workspace_id and e.id = p_subject_id and m.status = 'active'
    ) then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  else
    if not v_admin then
      raise exception 'Only admins write to clients.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.clients where id = p_subject_id and workspace_id = v_workspace_id) then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  v_sender := case when v_admin then 'admin' else 'editor' end;
  v_thread := public.thread_for(v_workspace_id, p_kind, p_subject_id);

  insert into public.messages (workspace_id, thread_id, sender, author_id, body)
  values (v_workspace_id, v_thread.id, v_sender, v_user, v_body);

  update public.message_threads
     set last_message_at = now(), last_message_preview = left(v_body, 160), last_sender = v_sender
   where id = v_thread.id;

  -- Writing in a thread means you've read it.
  insert into public.message_reads (workspace_id, thread_id, user_id, last_read_at)
  values (v_workspace_id, v_thread.id, v_user, now())
  on conflict (thread_id, user_id) do update set last_read_at = excluded.last_read_at;
  update public.notifications set read_at = now()
   where user_id = v_user and entity_type = 'thread' and entity_id = v_thread.id and read_at is null;

  select full_name into v_name from public.profiles where id = v_user;
  if v_sender = 'editor' then
    select array_agg(a.id) into v_admins from public.workspace_admin_ids(v_workspace_id) as a(id);
    perform public.notify_message(v_workspace_id, v_thread.id, coalesce(v_admins, '{}'), v_name, v_body,
                                  '/messages/team/' || v_user);
  elsif p_kind = 'editor' then
    perform public.notify_message(v_workspace_id, v_thread.id, array[p_subject_id], v_name, v_body, '/messages/team');
  end if;
  -- (A reply to a client is emailed to them by the app.)

  return v_thread.id;
end;
$$;

-- A message from a client, through their portal link. Called only by the
-- server (service role). Returns the thread id.
create or replace function public.post_client_message(p_token text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_portal public.client_portals;
  v_body text := trim(p_body);
  v_thread public.message_threads;
  v_client text;
  v_admins uuid[];
begin
  select * into v_portal from public.client_portals where token = p_token and enabled;
  if not found then
    raise exception 'invalid_link' using errcode = 'P0001';
  end if;
  if v_body is null or v_body = '' then
    raise exception 'empty_message' using errcode = 'P0001';
  end if;
  if char_length(v_body) > 4000 then
    raise exception 'message_too_long' using errcode = 'P0001';
  end if;

  v_thread := public.thread_for(v_portal.workspace_id, 'client', v_portal.client_id);
  if (select count(*) from public.messages
      where thread_id = v_thread.id and sender = 'client' and created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.messages (workspace_id, thread_id, sender, author_id, body)
  values (v_portal.workspace_id, v_thread.id, 'client', null, v_body);

  update public.message_threads
     set last_message_at = now(), last_message_preview = left(v_body, 160), last_sender = 'client',
         client_last_read_at = now()
   where id = v_thread.id;

  select public.client_display_name(company, contact_name) into v_client
  from public.clients where id = v_portal.client_id;
  select array_agg(a.id) into v_admins from public.workspace_admin_ids(v_portal.workspace_id) as a(id);
  perform public.notify_message(v_portal.workspace_id, v_thread.id, coalesce(v_admins, '{}'), v_client, v_body,
                                '/messages/clients/' || v_portal.client_id);

  return v_thread.id;
end;
$$;

-- Marks a thread read for the caller, with its message notifications.
create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id
  from public.message_threads
  where id = p_thread_id
    and workspace_id = (select public.current_workspace_id())
    and ((select public.is_admin()) or public.is_own_thread(id));
  if not found or not (select public.is_full_member()) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.message_reads (workspace_id, thread_id, user_id, last_read_at)
  values (v_workspace_id, p_thread_id, (select auth.uid()), now())
  on conflict (thread_id, user_id) do update set last_read_at = excluded.last_read_at;

  update public.notifications set read_at = now()
   where user_id = (select auth.uid()) and entity_type = 'thread' and entity_id = p_thread_id and read_at is null;
end;
$$;

-- Threads waiting for the caller: the other side wrote last, after the
-- caller last read. For admins, a colleague's reply counts as handled.
create or replace function public.unread_threads()
returns table (thread_id uuid, kind public.message_thread_kind)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.kind
  from public.message_threads t
  left join public.message_reads r on r.thread_id = t.id and r.user_id = (select auth.uid())
  where t.workspace_id = (select public.current_workspace_id())
    and (select public.is_full_member())
    and t.last_message_at is not null
    and t.last_message_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    and case
          when (select public.is_admin()) then t.last_sender <> 'admin'
          else t.kind = 'editor' and t.editor_id = (select auth.uid()) and t.last_sender = 'admin'
        end;
$$;

revoke all on function public.notify_message(uuid, uuid, uuid[], text, text, text) from public, anon, authenticated;
revoke all on function public.thread_for(uuid, public.message_thread_kind, uuid) from public, anon, authenticated;
revoke all on function public.post_message(public.message_thread_kind, uuid, text) from public, anon;
grant execute on function public.post_message(public.message_thread_kind, uuid, text) to authenticated;
revoke all on function public.post_client_message(text, text) from public, anon, authenticated;
grant execute on function public.post_client_message(text, text) to service_role;
revoke all on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;
revoke all on function public.unread_threads() from public, anon;
grant execute on function public.unread_threads() to authenticated;

-- -----------------------------------------------------------------------------
-- Announcements
-- -----------------------------------------------------------------------------

-- A new announcement goes to everyone with full access, except its author.
create or replace function public.notify_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author text;
begin
  select full_name into v_author from public.profiles where id = new.author_id;
  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  select new.workspace_id, m.user_id, 'new_announcement', new.title,
         nullif(concat_ws(' · ', v_author, left(regexp_replace(new.body, '\s+', ' ', 'g'), 140)), ''),
         '/messages', 'announcement', new.id
  from public.workspace_members m
  where m.workspace_id = new.workspace_id
    and m.status = 'active'
    and m.user_id is distinct from new.author_id;

  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
  values (new.workspace_id, new.author_id, 'announcement.posted', 'announcement', new.id,
          coalesce(v_author || ' posted: ', 'Announcement: ') || new.title);
  return null;
end;
$$;

create trigger notify_announcement
  after insert on public.announcements
  for each row execute function public.notify_announcement();

-- Removing an announcement takes its notifications with it.
create or replace function public.forget_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications where entity_type = 'announcement' and entity_id = old.id;
  return null;
end;
$$;

create trigger forget_announcement
  after delete on public.announcements
  for each row execute function public.forget_announcement();

-- Opening the announcements clears the badge and their notifications.
create or replace function public.mark_announcements_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.workspace_members
     set announcements_seen_at = now()
   where workspace_id = (select public.current_workspace_id())
     and user_id = (select auth.uid());
  update public.notifications
     set read_at = now()
   where user_id = (select auth.uid())
     and workspace_id = (select public.current_workspace_id())
     and type = 'new_announcement'
     and read_at is null;
end;
$$;

revoke all on function public.mark_announcements_seen() from public, anon;
grant execute on function public.mark_announcements_seen() to authenticated;

-- (Posting, pinning and removing announcements and comments is covered by
-- the policies from 0003: admins manage everything, people comment and
-- react as themselves.)

-- -----------------------------------------------------------------------------
-- Realtime: inboxes and the announcement feed update live
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.messages,
  public.message_threads,
  public.announcements,
  public.announcement_comments,
  public.announcement_reactions,
  public.sops,
  public.sop_acknowledgments;
