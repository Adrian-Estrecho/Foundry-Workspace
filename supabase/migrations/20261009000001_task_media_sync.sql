-- =============================================================================
-- ReEdit · Edited videos, and comments, links and files shared with ClickUp
--   * An edited video is a link with a version: each one sent for a task is
--     numbered here (v1, v2, …) and cards show the newest.
--   * Comments on a synced task go both ways. ClickUp's come in through the
--     sync (source 'clickup'): by the member with the same email, or under
--     the ClickUp name when there's none. People's comments here are posted
--     to ClickUp with their name in front.
--   * Links and files added to a synced task go to ClickUp too: files as
--     attachments, links as comments (ClickUp's API can't add a plain link
--     to a task).
--   * What goes to ClickUp waits in clickup_item_outbox until
--     /api/jobs/clickup sends it, like status and field changes do.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Edited videos, and what attachments became in ClickUp
-- -----------------------------------------------------------------------------
alter table public.task_attachments
  add column version smallint check (version > 0),
  -- The ClickUp attachment (files) or comment (links) it was sent as.
  add column clickup_id text,
  add constraint task_attachments_version_kind check (version is null or kind = 'link'),
  add constraint task_attachments_task_version_key unique (task_id, version);

-- Any version asked for becomes the task's next one. People can't say what
-- an attachment is in ClickUp; only the push records that.
create or replace function public.prepare_task_attachment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.clickup_id := null;
  end if;
  if new.version is not null then
    -- One numbering at a time per task.
    perform pg_advisory_xact_lock(hashtextextended('task_video:' || new.task_id::text, 0));
    select coalesce(max(a.version), 0) + 1 into new.version
    from public.task_attachments a
    where a.task_id = new.task_id;
  end if;
  return new;
end;
$$;

create trigger prepare_task_attachment
  before insert on public.task_attachments
  for each row execute function public.prepare_task_attachment();

-- -----------------------------------------------------------------------------
-- Comments from ClickUp
-- -----------------------------------------------------------------------------
alter table public.task_comments
  alter column author_id drop not null,
  add column source text not null default 'reedit' check (source in ('reedit', 'clickup')),
  -- The same comment in ClickUp: where it came from, or what it was posted as.
  add column clickup_comment_id text,
  -- ClickUp's name and picture, for someone who isn't a member here.
  add column clickup_author text,
  add column clickup_author_avatar text,
  add constraint task_comments_clickup_key unique (workspace_id, clickup_comment_id),
  add constraint task_comments_author check (source = 'clickup' or author_id is not null);

-- Only the sync says a comment came from ClickUp or what it is there.
create or replace function public.prepare_task_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.source := 'reedit';
    new.clickup_comment_id := null;
    new.clickup_author := null;
    new.clickup_author_avatar := null;
  else
    new.source := old.source;
    new.clickup_comment_id := old.clickup_comment_id;
    new.clickup_author := old.clickup_author;
    new.clickup_author_avatar := old.clickup_author_avatar;
  end if;
  return new;
end;
$$;

create trigger prepare_task_comment
  before insert or update on public.task_comments
  for each row execute function public.prepare_task_comment();

-- @mentions, now also from ClickUp comments (whose writer may not be a
-- member). The link opens the task with its comments showing.
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
  v_author := coalesce(v_author, new.clickup_author, 'Someone');

  insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id)
  select v_task.workspace_id, m.user_id, 'mention',
         v_author || ' mentioned you on ' || v_task.title,
         left(new.body, 160),
         case
           when not v_task.is_trial then '/tasks/' || v_task.id || '#comments'
           when m.role in ('owner', 'admin') then '/editors/' || v_task.assignee_id
           else '/onboarding'
         end,
         'task', v_task.id
  from public.workspace_members m
  where m.workspace_id = v_task.workspace_id
    and m.user_id = any (new.mentions)
    and m.user_id is distinct from new.author_id
    and m.status in ('onboarding', 'active')
    and ((m.role in ('owner', 'admin') and m.status = 'active') or m.user_id = v_task.assignee_id);

  return null;
end;
$$;

-- When a synced task's ClickUp comments were last read, so opening a task
-- doesn't ask ClickUp every time.
create table public.clickup_comment_syncs (
  task_id    uuid primary key references public.tasks (id) on delete cascade,
  synced_at  timestamptz not null default now()
);
alter table public.clickup_comment_syncs enable row level security;

-- -----------------------------------------------------------------------------
-- Comments, links and files waiting to go to ClickUp (service role only)
-- -----------------------------------------------------------------------------
create table public.clickup_item_outbox (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  task_id          uuid not null references public.tasks (id) on delete cascade,
  comment_id       uuid unique references public.task_comments (id) on delete cascade,
  attachment_id    uuid unique references public.task_attachments (id) on delete cascade,
  attempts         smallint not null default 0,
  next_attempt_at  timestamptz not null default now(),
  last_error       text,
  queued_at        timestamptz not null default now(),
  check (num_nonnulls(comment_id, attachment_id) = 1)
);
create index clickup_item_outbox_due_idx on public.clickup_item_outbox (next_attempt_at);
alter table public.clickup_item_outbox enable row level security;

-- Someone commented on a synced task: queue it for ClickUp. Comments the
-- sync brings in came from there.
create or replace function public.queue_clickup_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or new.source <> 'reedit' then
    return null;
  end if;
  if not exists (select 1 from public.tasks t where t.id = new.task_id and t.clickup_task_id is not null) then
    return null;
  end if;
  insert into public.clickup_item_outbox (workspace_id, task_id, comment_id) values (new.workspace_id, new.task_id, new.id);
  perform public.request_clickup_push();
  return null;
end;
$$;

create trigger queue_clickup_comment
  after insert on public.task_comments
  for each row execute function public.queue_clickup_comment();

-- Someone added a link or file to a synced task: queue it for ClickUp.
create or replace function public.queue_clickup_attachment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return null;
  end if;
  if not exists (select 1 from public.tasks t where t.id = new.task_id and t.clickup_task_id is not null) then
    return null;
  end if;
  insert into public.clickup_item_outbox (workspace_id, task_id, attachment_id) values (new.workspace_id, new.task_id, new.id);
  perform public.request_clickup_push();
  return null;
end;
$$;

create trigger queue_clickup_attachment
  after insert on public.task_attachments
  for each row execute function public.queue_clickup_attachment();

-- Asks the app to push (right after a change, and every minute for
-- retries) when either outbox has something due.
create or replace function public.request_clickup_push()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.clickup_outbox where next_attempt_at <= now())
     and not exists (select 1 from public.clickup_item_outbox where next_attempt_at <= now()) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'foundry_app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'foundry_jobs_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/jobs/clickup',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.request_clickup_push() from public, anon, authenticated;

-- Takes up to p_limit due items for one push run, with what's needed to send
-- them. Each is held for 10 minutes, so an overlapping run (the minutely
-- retry) doesn't send it twice; the run deletes it once sent, or sets when
-- to try again.
create function public.claim_clickup_items(p_limit integer default 20)
returns table (
  id                  uuid,
  workspace_id        uuid,
  task_id             uuid,
  attempts            smallint,
  clickup_task_id     text,
  task_title          text,
  comment_id          uuid,
  comment_body        text,
  comment_author      text,
  attachment_id       uuid,
  attachment_kind     text,
  attachment_url      text,
  attachment_path     text,
  attachment_label    text,
  attachment_version  smallint,
  attachment_author   text
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select o.id
    from public.clickup_item_outbox o
    where o.next_attempt_at <= now()
    order by o.queued_at
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update public.clickup_item_outbox o
    set next_attempt_at = now() + interval '10 minutes'
    from due
    where o.id = due.id
    returning o.*
  )
  select c.id, c.workspace_id, c.task_id, c.attempts, t.clickup_task_id, t.title,
         c.comment_id, cm.body, cp.full_name,
         c.attachment_id, a.kind, a.url, a.storage_path, a.label, a.version, ap.full_name
  from claimed c
  join public.tasks t on t.id = c.task_id
  left join public.task_comments cm on cm.id = c.comment_id
  left join public.profiles cp on cp.id = cm.author_id
  left join public.task_attachments a on a.id = c.attachment_id
  left join public.profiles ap on ap.id = a.added_by
  order by c.queued_at;
$$;

revoke all on function public.claim_clickup_items(integer) from public, anon, authenticated;
grant execute on function public.claim_clickup_items(integer) to service_role;
