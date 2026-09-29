-- =============================================================================
-- Foundry · local seed data
--
-- Sign in with any of these (password for all: foundry123):
--   admin@foundrymedia.co   Foundry Media owner · Alex Morgan
--   lucas@foundrymedia.co   Editor · Lucas Bennett (in Foundry Media and Tidewater Films)
--   maya@foundrymedia.co    Editor · Maya Chen
--   diego@foundrymedia.co   Editor · Diego Alvarez
--   priya@foundrymedia.co   Editor · Priya Nair (still onboarding: limited access)
--   nora@tidewater.test     Tidewater Films owner · Nora Quinn
--   sam@example.com         Sam Rivera, no workspace yet (lands on the welcome page)
--
-- Two workspaces, so anything leaking between companies shows up locally.
-- Dates are relative to now(), so the dashboard always looks "live":
-- ~6 months of attendance history, two editors working, one on break.
--
-- Tenant tables default to the signed-in user's workspace, which the seed
-- doesn't have, so top-level rows name theirs. Child rows (tasks on a
-- project, comments, checklist items, …) take it from their parent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Users (profiles come from the auth trigger)
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('foundry123', extensions.gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', u.full_name, 'timezone', u.tz),
  now() - u.joined, now(), '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@foundrymedia.co', 'Alex Morgan',   'America/New_York',    interval '400 days'),
  ('00000000-0000-4000-8000-000000000011'::uuid, 'lucas@foundrymedia.co', 'Lucas Bennett', 'America/New_York',    interval '300 days'),
  ('00000000-0000-4000-8000-000000000012'::uuid, 'maya@foundrymedia.co',  'Maya Chen',     'Europe/London',       interval '260 days'),
  ('00000000-0000-4000-8000-000000000013'::uuid, 'diego@foundrymedia.co', 'Diego Alvarez', 'America/Mexico_City', interval '220 days'),
  ('00000000-0000-4000-8000-000000000014'::uuid, 'priya@foundrymedia.co', 'Priya Nair',    'Asia/Kolkata',        interval '14 days'),
  ('00000000-0000-4000-8000-000000000021'::uuid, 'nora@tidewater.test',   'Nora Quinn',    'America/Los_Angeles', interval '120 days'),
  ('00000000-0000-4000-8000-000000000031'::uuid, 'sam@example.com',       'Sam Rivera',    'Europe/Madrid',       interval '1 day')
) as u(id, email, full_name, tz, joined);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), u.created_at, now()
from auth.users u
where u.id::text like '00000000-0000-4000-8000-%';

update public.profiles set phone = '+1 555 0100', last_seen_at = now()
where id = '00000000-0000-4000-8000-000000000001';

-- -----------------------------------------------------------------------------
-- Workspaces & memberships
-- -----------------------------------------------------------------------------
insert into public.workspaces (id, name, slug, asset_pack_url, frameio_invite_url, contract_template_url, default_accent, created_by, created_at)
values
  ('90000000-0000-4000-8000-000000000001', 'Foundry Media', 'foundry-media',
   'https://drive.google.com/drive/folders/foundry-editor-asset-pack',
   'https://app.frame.io/invite/foundry-media',
   'https://drive.google.com/drive/folders/foundry-editor-contracts',
   '#F2711C', '00000000-0000-4000-8000-000000000001', now() - interval '400 days'),
  ('90000000-0000-4000-8000-000000000002', 'Tidewater Films', 'tidewater',
   'https://drive.google.com/drive/folders/tidewater-asset-pack',
   null, null,
   '#2F8FDD', '00000000-0000-4000-8000-000000000021', now() - interval '120 days');

insert into public.workspace_members (workspace_id, user_id, role, status, joined_at, approved_at)
select v.workspace_id, v.user_id, v.role::public.member_role, v.status::public.member_status,
       now() - v.joined, case when v.status = 'active' then now() - v.joined + interval '3 days' end
from (values
  ('90000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, 'owner',  'active',     interval '400 days'),
  ('90000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000011'::uuid, 'editor', 'active',     interval '300 days'),
  ('90000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000012'::uuid, 'editor', 'active',     interval '260 days'),
  ('90000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000013'::uuid, 'editor', 'active',     interval '220 days'),
  ('90000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000014'::uuid, 'editor', 'onboarding', interval '14 days'),
  ('90000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-000000000021'::uuid, 'owner',  'active',     interval '120 days'),
  ('90000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-000000000011'::uuid, 'editor', 'active',     interval '60 days')
) as v(workspace_id, user_id, role, status, joined);

update public.profiles p set active_workspace_id = m.workspace_id
from public.workspace_members m
where m.user_id = p.id
  and m.workspace_id = case when p.id = '00000000-0000-4000-8000-000000000021'
                            then '90000000-0000-4000-8000-000000000002'::uuid
                            else '90000000-0000-4000-8000-000000000001'::uuid end;

-- Editors (their onboarding checklists come from a trigger). Lucas edits for
-- both companies.
insert into public.editors (workspace_id, id, software, specialties, hourly_rate, weekly_hours, created_at, onboarding_completed_at)
select v.workspace_id, v.id, v.software, v.specialties, v.rate, v.hours, now() - v.joined,
       case when v.onboarded then now() - v.joined + interval '3 days' end
from (values
  ('90000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000011'::uuid, array['Premiere Pro', 'After Effects'],   array['Short-form', 'Motion graphics'],     35.00, 40, true,  interval '300 days'),
  ('90000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000012'::uuid, array['DaVinci Resolve', 'Premiere Pro'], array['Color grading', 'Long-form YouTube'], 42.00, 32, true,  interval '260 days'),
  ('90000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000013'::uuid, array['Premiere Pro', 'CapCut'],          array['Short-form', 'Paid social ads'],     28.00, 40, true,  interval '220 days'),
  ('90000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000014'::uuid, array['Final Cut Pro', 'After Effects'],  array['Motion graphics', 'Documentary'],    38.00, 25, false, interval '14 days'),
  ('90000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-000000000011'::uuid, array['Premiere Pro', 'After Effects'],   array['Short-form', 'Motion graphics'],     40.00, 10, true,  interval '60 days')
) as v(workspace_id, id, software, specialties, rate, hours, onboarded, joined);

insert into public.editor_payment_details (workspace_id, editor_id, method, details)
values
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'bank',   '{"account_name": "Lucas Bennett", "bank_name": "Chase", "account_number": "•••• 4821", "routing": "021000021", "country": "United States"}'),
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'wise',   '{"email": "maya.chen@hey.com", "currency": "GBP"}'),
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000013', 'paypal', '{"email": "diego.alvarez@gmail.com"}'),
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000014', 'wise',   '{"email": "priya.nair@outlook.com", "currency": "INR"}'),
  ('90000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000011', 'paypal', '{"email": "lucas.bennett@gmail.com"}');

-- Onboarding: everyone approved is done; Priya is halfway. (Set after the
-- inserts above, which tick steps automatically.)
update public.editor_checklist_items i
set is_done = true, done_at = e.onboarding_completed_at - interval '1 hour'
from public.editors e
where e.workspace_id = i.workspace_id and e.id = i.editor_id and e.onboarding_completed_at is not null;

update public.editor_checklist_items
set is_done = (key in ('contract_nda', 'payment_details', 'frameio')),
    done_at = case when key in ('contract_nda', 'payment_details', 'frameio') then now() - interval '10 days' end
where workspace_id = '90000000-0000-4000-8000-000000000001'
  and editor_id = '00000000-0000-4000-8000-000000000014';

-- -----------------------------------------------------------------------------
-- Leads & clients
-- -----------------------------------------------------------------------------
insert into public.leads (workspace_id, id, name, company, email, phone, project_type, budget_range, deadline, reference_links, notes, created_at)
values
  ('90000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Hannah Lee', 'Bright Path Academy', 'hannah@brightpath.edu', '+1 555 0141',
   'YouTube long-form', '$2k–5k / month', current_date + 45,
   array['https://youtube.com/@brightpath'], 'Looking for 4 videos per month, course trailers too.', now() - interval '5 hours'),
  ('90000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'Omar Haddad', 'Cedar & Stone Realty', 'omar@cedarstone.com', '+1 555 0172',
   'Property walkthroughs', '$1k–2k / month', current_date + 30,
   array['https://instagram.com/cedarstone'], 'Weekly listing reels, vertical.', now() - interval '3 days');

insert into public.clients (
  workspace_id, id, lead_id, contact_name, company, email, phone, stage, position, stage_changed_at,
  project_type, budget_range, drive_folder_url, contract_path, deposit_status, final_status,
  call_notes, created_at
)
values
  ('90000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', null, 'Sarah Kim', 'Northwind Fitness', 'sarah@northwindfit.com', '+1 555 0110',
   'active_client', 1, now() - interval '120 days', 'Short-form social', '$5k+ / month',
   'https://drive.google.com/drive/folders/northwind', 'c0000000-0000-4000-8000-000000000001/contract.pdf', 'paid', 'unpaid',
   'Wants punchy hooks in first 2s. Brand colors: navy + lime.', now() - interval '150 days'),
  ('90000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', null, 'Marcus Webb', 'Lumen Coffee Co.', 'marcus@lumencoffee.com', '+1 555 0120',
   'active_client', 2, now() - interval '90 days', 'YouTube series + ads', '$2k–5k / month',
   'https://drive.google.com/drive/folders/lumen', 'c0000000-0000-4000-8000-000000000002/contract.pdf', 'paid', 'paid',
   'Documentary tone, warm grade. Episodes ~12 min.', now() - interval '110 days'),
  ('90000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', null, 'Nina Park', 'Atlas Outdoor', 'nina@atlasoutdoor.co', '+1 555 0130',
   'kickoff', 1, now() - interval '2 days', 'Campaign launch', '$5k+ project',
   'https://drive.google.com/drive/folders/atlas', 'c0000000-0000-4000-8000-000000000003/contract.pdf', 'paid', 'unpaid',
   'Kickoff Thursday. Needs 3 hero cuts + 12 cutdowns.', now() - interval '20 days'),
  ('90000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', 'Hannah Lee', 'Bright Path Academy', 'hannah@brightpath.edu', '+1 555 0141',
   'new_lead', 1, now() - interval '5 hours', 'YouTube long-form', '$2k–5k / month',
   null, null, 'unpaid', 'unpaid', null, now() - interval '5 hours'),
  ('90000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000002', 'Omar Haddad', 'Cedar & Stone Realty', 'omar@cedarstone.com', '+1 555 0172',
   'discovery_call', 1, now() - interval '1 day', 'Property walkthroughs', '$1k–2k / month',
   null, null, 'unpaid', 'unpaid', 'Call booked for Friday.', now() - interval '3 days');

-- Onboarding checklists for clients past "Contract Signed".
insert into public.client_checklist_items (client_id, key, label, position, is_done, done_at)
select c.id, i.key, i.label, i.position,
       c.id <> 'c0000000-0000-4000-8000-000000000003' or i.position <= 4,
       case when c.id <> 'c0000000-0000-4000-8000-000000000003' or i.position <= 4 then c.stage_changed_at end
from public.clients c
cross join (values
  ('contract_uploaded', 'Contract signed and uploaded',     1),
  ('deposit_received',  'Deposit received',                 2),
  ('drive_folder',      'Drive folder created and link added', 3),
  ('brief_collected',   'Brief and references collected',   4),
  ('editor_assigned',   'Editor assigned',                  5),
  ('kickoff_done',      'Kickoff call done',                6)
) as i(key, label, position)
where c.stage >= 'contract_signed'
on conflict (client_id, key) do update set is_done = excluded.is_done, done_at = excluded.done_at;

-- Completing those checklists logged "finished client onboarding" just now;
-- date it to when the client actually reached their current stage.
update public.activity_log a
set created_at = c.stage_changed_at
from public.clients c
where a.entity_id = c.id and a.action = 'client.onboarding_completed';

-- -----------------------------------------------------------------------------
-- Applicants
-- -----------------------------------------------------------------------------
-- The insert trigger logs each one and notifies admins (dated to created_at).
insert into public.applicants (
  workspace_id, id,
  full_name, email, portfolio_url, software, specialties, timezone, hourly_rate, weekly_hours,
  availability_notes, stage, position, rating, admin_notes, created_at, stage_changed_at
)
values
  ('90000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'Jonah Reyes',  'jonah.reyes@gmail.com', 'https://vimeo.com/jonahreyes', array['Premiere Pro'], array['Short-form'],
   'Asia/Manila', 18, 40, 'Weekdays, overlapping US mornings.', 'applied', 1, null, null,
   now() - interval '1 day', now() - interval '1 day'),
  ('90000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 'Elena Varga',  'elena.v@proton.me', 'https://elenavarga.com', array['DaVinci Resolve', 'After Effects'], array['Color grading', 'Paid social ads'],
   'Europe/Budapest', 32, 30, null, 'shortlisted', 1, 4, 'Strong grading reel. Worth inviting once the Atlas work lands.',
   now() - interval '6 days', now() - interval '4 days'),
  ('90000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000003', 'Sofia Marin',  'sofia.marin@gmail.com', 'https://youtube.com/@sofiacuts', array['Premiere Pro', 'CapCut'], array['Short-form', 'Long-form YouTube'],
   'America/Bogota', 22, 40, 'Full time from next month.', 'shortlisted', 2, 4, null,
   now() - interval '9 days', now() - interval '1 day'),
  ('90000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000004', 'Kwame Asante', 'kwame@asante.studio', 'https://asante.studio/reel', array['Premiere Pro', 'After Effects'], array['Motion graphics'],
   'Africa/Accra', 26, 35, null, 'invited', 1, 5, 'Great kinetic type on his reel. Invited.',
   now() - interval '12 days', now() - interval '2 days'),
  ('90000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000005', 'Tom Becker',   'tom.becker@web.de', null, array['iMovie'], array['Vlogs'],
   'Europe/Berlin', 60, 10, null, 'rejected', 1, 2, 'No portfolio, rate well above budget.',
   now() - interval '20 days', now() - interval '18 days');

-- Kwame's invitation is out. (Codes are 12 characters; people type them as
-- FDRY-KWAM-E234, in any case.)
insert into public.workspace_invitations (workspace_id, code, email, full_name, applicant_id, invited_by, created_at, sent_at)
values
  ('90000000-0000-4000-8000-000000000001', 'FDRYKWAME234', 'kwame@asante.studio', 'Kwame Asante',
   '60000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', now() - interval '2 days', now() - interval '2 days'),
  -- For trying the join flow as sam@example.com: joins Tidewater Films.
  ('90000000-0000-4000-8000-000000000002', 'TDWTSAMR2345', 'sam@example.com', 'Sam Rivera',
   null, '00000000-0000-4000-8000-000000000021', now() - interval '1 day', now() - interval '1 day');

-- The test edit Foundry Media gives everyone who joins.
insert into public.workspace_settings (workspace_id, test_title, test_brief, test_asset_url, test_due_days)
values ('90000000-0000-4000-8000-000000000001', 'Test edit · 30s product teaser',
        E'Cut a 30-second vertical teaser from the sample footage.
Hook in the first 2 seconds, captions burned in, music from the pack.',
        'https://drive.google.com/drive/folders/foundry-test-edit', 3);

-- Older applicants have been seen already.
update public.notifications set read_at = created_at + interval '1 hour'
where type = 'new_applicant' and created_at < now() - interval '2 days';

-- -----------------------------------------------------------------------------
-- Projects
-- -----------------------------------------------------------------------------
insert into public.projects (id, client_id, name, status, deadline, drive_folder_url, frameio_url, spec_format, spec_aspect_ratio, spec_length, created_by, delivered_at, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Q4 Reels Package',        'in_progress',   current_date + 14, 'https://drive.google.com/drive/folders/northwind-q4', 'https://app.frame.io/projects/northwind-q4', 'MP4 H.264', '9:16', '30–45s', '00000000-0000-4000-8000-000000000001', null, now() - interval '40 days'),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Brand Anthem Film',       'client_review', current_date + 6,  'https://drive.google.com/drive/folders/northwind-anthem', 'https://app.frame.io/projects/northwind-anthem', 'ProRes 422', '16:9', '90s', '00000000-0000-4000-8000-000000000001', null, now() - interval '30 days'),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'YouTube Series: Origins', 'in_progress',   current_date + 21, 'https://drive.google.com/drive/folders/lumen-origins', 'https://app.frame.io/projects/lumen-origins', 'MP4 H.264', '16:9', '10–14 min', '00000000-0000-4000-8000-000000000001', null, now() - interval '60 days'),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000003', 'Spring Campaign Launch',  'brief_received', current_date + 35, 'https://drive.google.com/drive/folders/atlas-spring', null, 'MP4 H.264', '1:1, 9:16, 16:9', '15s / 30s / 60s', '00000000-0000-4000-8000-000000000001', null, now() - interval '2 days'),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', 'Holiday Ads',             'delivered',     current_date - 40, 'https://drive.google.com/drive/folders/lumen-holiday', 'https://app.frame.io/projects/lumen-holiday', 'MP4 H.264', '9:16', '15s', '00000000-0000-4000-8000-000000000001', now() - interval '42 days', now() - interval '180 days');

insert into public.project_editors (project_id, editor_id)
values
  ('b0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011'),
  ('b0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000013'),
  ('b0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012'),
  ('b0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000012'),
  ('b0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000011'),
  ('b0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000013'),
  ('b0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000011'),
  ('b0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000013');

-- -----------------------------------------------------------------------------
-- Tasks: current work
-- Seeded tasks are history, not news: no "New task" notifications or feed
-- entries for them (the notifications that matter are inserted below).
-- -----------------------------------------------------------------------------
alter table public.tasks disable trigger notify_task_changes;
alter table public.tasks disable trigger log_task_activity;

insert into public.tasks (workspace_id, id, project_id, title, description, assignee_id, due_date, priority, status, revision_count, progress_pct, is_trial, position, created_by, created_at)
values
  -- Lucas
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Reel 04 · rough cut',         'Hook in first 2s, captions burned in.', '00000000-0000-4000-8000-000000000011', current_date,     'high',   'in_progress', 0, 40, false, 1, '00000000-0000-4000-8000-000000000001', now() - interval '6 days'),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Reel 03 · captions & SFX',    null,                                    '00000000-0000-4000-8000-000000000011', current_date + 1, 'medium', 'for_review',  0, 90, false, 1, '00000000-0000-4000-8000-000000000001', now() - interval '8 days'),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'Origins Ep.2 · assembly',     'Selects are in /02_Selects.',           '00000000-0000-4000-8000-000000000011', current_date + 3, 'medium', 'todo',        0, 0,  false, 1, '00000000-0000-4000-8000-000000000001', now() - interval '3 days'),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'Reel 02 · revisions',         'Client wants a faster intro.',          '00000000-0000-4000-8000-000000000011', current_date - 1, 'urgent', 'revisions',   1, 70, false, 1, '00000000-0000-4000-8000-000000000001', now() - interval '12 days'),
  -- Maya
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'Anthem · color grade',        'Warm, filmic. LUT in Drive.',           '00000000-0000-4000-8000-000000000012', current_date + 2, 'high',   'in_progress', 0, 60, false, 1, '00000000-0000-4000-8000-000000000001', now() - interval '5 days'),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000003', 'Origins Ep.1 · final export', null,                                    '00000000-0000-4000-8000-000000000012', current_date,     'high',   'for_review',  1, 95, false, 2, '00000000-0000-4000-8000-000000000001', now() - interval '9 days'),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000002', 'Anthem · client notes v2',    null,                                    '00000000-0000-4000-8000-000000000012', current_date + 4, 'medium', 'todo',        0, 0,  false, 2, '00000000-0000-4000-8000-000000000001', now() - interval '1 day'),
  -- Diego
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', 'Reel 05 · hook variations',   'Three alternate hooks, same body.',     '00000000-0000-4000-8000-000000000013', current_date + 1, 'medium', 'in_progress', 0, 25, false, 2, '00000000-0000-4000-8000-000000000001', now() - interval '4 days'),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000004', 'Spring Launch · selects',     null,                                    '00000000-0000-4000-8000-000000000013', current_date + 5, 'medium', 'todo',        0, 0,  false, 3, '00000000-0000-4000-8000-000000000001', now() - interval '2 days'),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001', 'Reel 01 · subtitle fixes',    'Typos flagged in Frame.io.',            '00000000-0000-4000-8000-000000000013', current_date - 2, 'high',   'todo',        0, 0,  false, 4, '00000000-0000-4000-8000-000000000001', now() - interval '7 days'),
  -- Priya
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', null,                                   'Test edit · 30s product teaser', 'Use the sample footage in the asset pack.', '00000000-0000-4000-8000-000000000014', current_date + 2, 'medium', 'in_progress', 0, 30, true,  1, '00000000-0000-4000-8000-000000000001', now() - interval '6 days'),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000004', 'Spring Launch · motion toolkit', 'Lower thirds + end card.',             '00000000-0000-4000-8000-000000000013', current_date + 6, 'low',    'todo',        0, 0,  false, 2, '00000000-0000-4000-8000-000000000001', now() - interval '2 days');

insert into public.subtasks (workspace_id, task_id, title, is_done, position)
values
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Pull selects',          true,  1),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Rough assembly',        true,  2),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Captions',              false, 3),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Music + SFX pass',      false, 4),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'Primary balance',       true,  1),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'Look development',      true,  2),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'Shot matching',         false, 3);

-- Completed work over the last ~6 months (feeds the charts and performance
-- stats). Roughly a quarter are delivered a day late.
insert into public.tasks (project_id, title, assignee_id, due_date, priority, status, revision_count, completed_at, position, created_by, created_at)
select
  (array[
    'b0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002'
  ]::uuid[])[1 + g % 4],
  (array['Reel', 'Short', 'Cutdown', 'Episode', 'Teaser', 'Ad variant'])[1 + g % 6] || ' ' || lpad(g::text, 2, '0') || ' · final',
  (array[
    '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000013'
  ]::uuid[])[1 + g % 3],
  current_date - g * 4,
  (array['low', 'medium', 'medium', 'high']::public.task_priority[])[1 + g % 4],
  'done',
  (g / 3) % 3,
  (current_date - g * 4 + (g % 4 - 2))::timestamp + time '16:00',
  g,
  '00000000-0000-4000-8000-000000000001',
  now() - make_interval(days => g * 4 + 16)
from generate_series(1, 45) as g;

alter table public.tasks enable trigger notify_task_changes;
alter table public.tasks enable trigger log_task_activity;

-- A few comments, links and a mention, so task pages have a conversation.
-- (The mention's notification is inserted with the others below.)
alter table public.task_comments disable trigger notify_task_mentions;
insert into public.task_comments (workspace_id, task_id, author_id, body, mentions, created_at)
values
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Client wants a faster intro. Cut the first 3 seconds and open on the product shot.', '{}', now() - interval '20 hours'),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000011', 'On it. I''ll have v2 up this afternoon.', '{}', now() - interval '19 hours'),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '@Alex Morgan should the captions follow the brand font or the platform default?', '{00000000-0000-4000-8000-000000000001}', now() - interval '3 hours'),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Brand font, please. It''s in the asset pack.', '{}', now() - interval '2 hours 40 minutes');
alter table public.task_comments enable trigger notify_task_mentions;

insert into public.task_attachments (workspace_id, task_id, kind, url, label, added_by, created_at)
values
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'link', 'https://app.frame.io/reviews/northwind-reel-03-v2', 'Frame.io review · v2', '00000000-0000-4000-8000-000000000011', now() - interval '1 hour 10 minutes'),
  ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'link', 'https://drive.google.com/drive/folders/northwind-anthem/luts', 'LUT folder', '00000000-0000-4000-8000-000000000001', now() - interval '5 days');

-- -----------------------------------------------------------------------------
-- Attendance history (Foundry Media): one shift per scheduled workday (not
-- today), two task blocks split by a break. Values are deterministic per
-- editor/day.
-- -----------------------------------------------------------------------------
with days as (
  select
    e.workspace_id,
    e.id as editor_id,
    p.timezone as tz,
    d::date as work_date
  from public.editors e
  join public.profiles p on p.id = e.id
  cross join generate_series(current_date - 182, current_date - 1, interval '1 day') as d
  where e.workspace_id = '90000000-0000-4000-8000-000000000001'
    and extract(isodow from d)::smallint = any (e.work_days)
    and d::date >= (e.created_at at time zone p.timezone)::date
    and e.onboarding_completed_at is not null                     -- candidates can't clock in
    and abs(hashtext(e.id::text || d::text)) % 100 >= 6          -- ~6% days off
),
shaped as (
  select
    workspace_id,
    editor_id,
    work_date,
    ((work_date + time '09:00') at time zone tz)
      + make_interval(mins => abs(hashtext(editor_id::text || work_date::text || 's')) % 50) as start_at,
    make_interval(mins => 150 + abs(hashtext(editor_id::text || work_date::text || 'a')) % 90)  as block1,
    make_interval(mins => 20  + abs(hashtext(editor_id::text || work_date::text || 'b')) % 40)  as brk,
    make_interval(mins => 120 + abs(hashtext(editor_id::text || work_date::text || 'c')) % 120) as block2
  from days
),
new_shifts as (
  insert into public.shifts (workspace_id, editor_id, clock_in_at, clock_out_at, work_date, work_seconds, break_seconds, ended_by)
  select
    workspace_id, editor_id, start_at, start_at + block1 + brk + block2, work_date,
    extract(epoch from block1 + block2)::integer,
    extract(epoch from brk)::integer,
    'editor'
  from shaped
  returning id, workspace_id, editor_id, work_date
)
insert into public.time_logs (workspace_id, editor_id, shift_id, task_id, started_at, ended_at)
select s.workspace_id, s.editor_id, s.id, pick.task_id, b.started_at, b.ended_at
from new_shifts s
join shaped sh on sh.editor_id = s.editor_id and sh.work_date = s.work_date
cross join lateral (values
  (1, sh.start_at,                     sh.start_at + sh.block1),
  (2, sh.start_at + sh.block1 + sh.brk, sh.start_at + sh.block1 + sh.brk + sh.block2)
) as b(block, started_at, ended_at)
left join lateral (
  select t.id as task_id
  from public.tasks t
  where t.workspace_id = s.workspace_id
    and t.assignee_id = s.editor_id
    and t.created_at::date <= s.work_date
    and (t.completed_at is null or t.completed_at::date >= s.work_date)
  order by md5(t.id::text || s.work_date::text || b.block::text)
  limit 1
) as pick on true;

-- -----------------------------------------------------------------------------
-- Today: Lucas and Diego are working, Maya is on a break, Priya is off.
-- -----------------------------------------------------------------------------
insert into public.shifts (workspace_id, id, editor_id, clock_in_at, work_date)
values
  ('90000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000011', now() - interval '2 hours 15 minutes', ((now() - interval '2 hours 15 minutes') at time zone 'America/New_York')::date),
  ('90000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000012', now() - interval '3 hours 40 minutes', ((now() - interval '3 hours 40 minutes') at time zone 'Europe/London')::date),
  ('90000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000013', now() - interval '45 minutes',         ((now() - interval '45 minutes') at time zone 'America/Mexico_City')::date);

insert into public.time_logs (editor_id, shift_id, task_id, started_at, ended_at)
values
  ('00000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002', now() - interval '2 hours 15 minutes', now() - interval '1 hour 10 minutes'),
  ('00000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', now() - interval '1 hour 10 minutes', null),
  ('00000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000005', now() - interval '3 hours 40 minutes', now() - interval '12 minutes'),
  ('00000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000008', now() - interval '45 minutes',         null);

insert into public.status_events (editor_id, shift_id, status, task_id, reason, created_at)
values
  ('00000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000011', 'working',  'a0000000-0000-4000-8000-000000000002', 'clock_in',    now() - interval '2 hours 15 minutes'),
  ('00000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000011', 'working',  'a0000000-0000-4000-8000-000000000001', 'task_switch', now() - interval '1 hour 10 minutes'),
  ('00000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000012', 'working',  'a0000000-0000-4000-8000-000000000005', 'clock_in',    now() - interval '3 hours 40 minutes'),
  ('00000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000012', 'on_break', 'a0000000-0000-4000-8000-000000000005', 'break',       now() - interval '12 minutes'),
  ('00000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000013', 'working',  'a0000000-0000-4000-8000-000000000008', 'clock_in',    now() - interval '45 minutes');

update public.editors e set
  work_status = v.status::public.work_status,
  current_task_id = v.task_id,
  current_shift_id = v.shift_id,
  status_since = now() - v.since
from (values
  ('00000000-0000-4000-8000-000000000011'::uuid, 'working',  'a0000000-0000-4000-8000-000000000001'::uuid, 'd0000000-0000-4000-8000-000000000011'::uuid, interval '2 hours 15 minutes'),
  ('00000000-0000-4000-8000-000000000012'::uuid, 'on_break', 'a0000000-0000-4000-8000-000000000005'::uuid, 'd0000000-0000-4000-8000-000000000012'::uuid, interval '12 minutes'),
  ('00000000-0000-4000-8000-000000000013'::uuid, 'working',  'a0000000-0000-4000-8000-000000000008'::uuid, 'd0000000-0000-4000-8000-000000000013'::uuid, interval '45 minutes')
) as v(id, status, task_id, shift_id, since)
where e.workspace_id = '90000000-0000-4000-8000-000000000001' and e.id = v.id;

update public.profiles p set last_seen_at = now() - v.ago
from (values
  ('00000000-0000-4000-8000-000000000011'::uuid, interval '1 minute'),
  ('00000000-0000-4000-8000-000000000012'::uuid, interval '6 minutes'),
  ('00000000-0000-4000-8000-000000000013'::uuid, interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000014'::uuid, interval '20 hours'),
  ('00000000-0000-4000-8000-000000000021'::uuid, interval '3 hours')
) as v(id, ago)
where p.id = v.id;

-- -----------------------------------------------------------------------------
-- Announcements, meetings, SOPs, ideas
-- -----------------------------------------------------------------------------
insert into public.meetings (workspace_id, id, title, starts_at, duration_minutes, meeting_url, agenda, created_by)
values
  ('90000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Weekly team sync',
   date_trunc('week', now()) + interval '7 days 15 hours', 30, 'https://meet.google.com/foundry-sync',
   E'1. Wins of the week\n2. Blockers\n3. Next week''s deliveries', '00000000-0000-4000-8000-000000000001');

-- Seeded announcements are history: no "new announcement" notifications.
alter table public.announcements disable trigger notify_announcement;

insert into public.announcements (workspace_id, id, author_id, title, body, is_pinned, meeting_id, created_at)
values
  ('90000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Welcome to Foundry',
   'This is our new home base. Start work from the top bar, keep task status up to date, and check here for updates.',
   true, null, now() - interval '14 days'),
  ('90000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Weekly team sync moves to Mondays',
   E'From next week the team sync is Monday at 3pm (New York time), 30 minutes.\nBring one win and one blocker. Link: https://meet.google.com/foundry-sync',
   false, null, now() - interval '1 day');

insert into public.announcement_comments (announcement_id, author_id, body, created_at)
values
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'Love having everything in one place. The timer is great.', now() - interval '13 days'),
  ('40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013', 'Works for me. I''ll join from Mexico City, so that''s 1pm here.', now() - interval '20 hours');

insert into public.announcement_reactions (announcement_id, user_id, emoji)
values
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '🎉'),
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', '🎉'),
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000013', '👍'),
  ('40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000011', '👍');

insert into public.meeting_rsvps (meeting_id, user_id, status)
values
  ('f0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'going'),
  ('f0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'maybe');

insert into public.sops (workspace_id, id, title, category, content, is_required, created_by)
values
  ('90000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Editing workflow: from brief to delivery', 'editing_workflow',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Read the brief, pull selects, rough cut, internal review, client review, delivery."}]}]}',
   true, '00000000-0000-4000-8000-000000000001'),
  ('90000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'Reviewing in Frame.io', 'frameio_review',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Upload versions to the project folder, resolve every comment before re-uploading."}]}]}',
   true, '00000000-0000-4000-8000-000000000001'),
  ('90000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'File naming & delivery', 'file_naming_delivery',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"CLIENT_PROJECT_DELIVERABLE_v01.mp4. Deliver to /05_Exports."}]}]}',
   false, '00000000-0000-4000-8000-000000000001'),
  ('90000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000004', 'Communication norms', 'communication',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Flag blockers early. Reply to mentions within 4 working hours."}]}]}',
   false, '00000000-0000-4000-8000-000000000001');

insert into public.sop_acknowledgments (sop_id, editor_id, acknowledged_at)
select s.id, e.id, now() - interval '150 days'
from public.sops s
join public.editors e on e.workspace_id = s.workspace_id
where s.is_required and e.onboarding_completed_at is not null;

insert into public.ideas (workspace_id, author_id, title, body, created_at)
values
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'Shared LUT library', 'One Drive folder with approved LUTs per client.', now() - interval '6 days'),
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Monthly best-cut showcase', 'Each editor shares their favourite edit of the month.', now() - interval '2 days');

-- -----------------------------------------------------------------------------
-- Activity feed & notifications
-- -----------------------------------------------------------------------------
insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary, created_at)
select '90000000-0000-4000-8000-000000000001'::uuid, v.*
from (values
  ('00000000-0000-4000-8000-000000000012'::uuid, 'editor.started_work',  'editor', '00000000-0000-4000-8000-000000000012'::uuid, 'Maya Chen started working on Anthem · color grade',  now() - interval '3 hours 40 minutes'),
  ('00000000-0000-4000-8000-000000000011'::uuid, 'editor.started_work',  'editor', '00000000-0000-4000-8000-000000000011'::uuid, 'Lucas Bennett started working on Reel 03 · captions & SFX', now() - interval '2 hours 15 minutes'),
  ('00000000-0000-4000-8000-000000000011'::uuid, 'task.status_changed',  'task',   'a0000000-0000-4000-8000-000000000002'::uuid, 'Lucas Bennett moved Reel 03 · captions & SFX to For Review', now() - interval '1 hour 10 minutes'),
  ('00000000-0000-4000-8000-000000000013'::uuid, 'editor.started_work',  'editor', '00000000-0000-4000-8000-000000000013'::uuid, 'Diego Alvarez started working on Reel 05 · hook variations', now() - interval '45 minutes'),
  ('00000000-0000-4000-8000-000000000012'::uuid, 'editor.took_break',    'editor', '00000000-0000-4000-8000-000000000012'::uuid, 'Maya Chen is on a break',                            now() - interval '12 minutes'),
  ('00000000-0000-4000-8000-000000000001'::uuid, 'client.stage_changed', 'client', 'c0000000-0000-4000-8000-000000000003'::uuid, 'Atlas Outdoor moved to Kickoff',                     now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000012'::uuid, 'task.status_changed',  'task',   'a0000000-0000-4000-8000-000000000006'::uuid, 'Maya Chen moved Origins Ep.1 · final export to For Review', now() - interval '26 hours')
) as v(actor_id, action, entity_type, entity_id, summary, created_at);

insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id, created_at)
select '90000000-0000-4000-8000-000000000001'::uuid, v.user_id, v.type::public.notification_type, v.title, v.body, v.link, v.entity_type, v.entity_id, v.created_at
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'task_for_review',    'Ready for review: Reel 03 · captions & SFX', 'Lucas Bennett', '/tasks/a0000000-0000-4000-8000-000000000002', 'task', 'a0000000-0000-4000-8000-000000000002'::uuid, now() - interval '1 hour 10 minutes'),
  ('00000000-0000-4000-8000-000000000011'::uuid, 'revision_requested', 'Changes requested: Reel 02', 'Client wants a faster intro.', '/tasks/a0000000-0000-4000-8000-000000000004', 'task', 'a0000000-0000-4000-8000-000000000004'::uuid, now() - interval '20 hours'),
  ('00000000-0000-4000-8000-000000000014'::uuid, 'task_assigned',      'Your test edit: Test edit · 30s product teaser', null, '/onboarding', 'task', 'a0000000-0000-4000-8000-000000000011'::uuid, now() - interval '6 days'),
  ('00000000-0000-4000-8000-000000000001'::uuid, 'mention',            'Lucas Bennett mentioned you on Reel 04 · rough cut', '@Alex Morgan should the captions follow the brand font or the platform default?', '/tasks/a0000000-0000-4000-8000-000000000001', 'task', 'a0000000-0000-4000-8000-000000000001'::uuid, now() - interval '3 hours')
) as v(user_id, type, title, body, link, entity_type, entity_id, created_at);

-- Priya's interview is booked for the day after tomorrow.
insert into public.editor_interviews (workspace_id, editor_id, scheduled_at, duration_minutes, meeting_url, note_to_editor, created_by, created_at)
values ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000014',
        date_trunc('hour', now()) + interval '2 days 2 hours', 30, 'https://meet.google.com/foundry-priya',
        'A relaxed 30-minute chat: your reel, how you like to work, and questions for us.',
        '00000000-0000-4000-8000-000000000001', now() - interval '1 day');

-- =============================================================================
-- Tidewater Films: a second, smaller company. Lucas edits for them too.
-- =============================================================================
insert into public.clients (workspace_id, id, contact_name, company, email, stage, position, stage_changed_at,
                            project_type, budget_range, drive_folder_url, deposit_status, created_at)
values
  ('90000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'Iris Novak', 'Harbor Coffee Roasters',
   'iris@harborcoffee.test', 'active_client', 1, now() - interval '40 days', 'Short-form social', '$1k–2k / month',
   'https://drive.google.com/drive/folders/harbor', 'paid', now() - interval '50 days');

insert into public.projects (id, client_id, name, status, deadline, spec_format, spec_aspect_ratio, spec_length, created_by, created_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Harbor · Spring Reels', 'in_progress',
   current_date + 10, 'MP4 H.264', '9:16', '20–30s', '00000000-0000-4000-8000-000000000021', now() - interval '20 days');

alter table public.tasks disable trigger notify_task_changes;
alter table public.tasks disable trigger log_task_activity;

insert into public.tasks (id, project_id, title, description, assignee_id, due_date, priority, status, position, created_by, created_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Harbor Reel 01 · rough cut', 'Latte art b-roll first.',
   '00000000-0000-4000-8000-000000000011', current_date + 2, 'high', 'todo', 1, '00000000-0000-4000-8000-000000000021', now() - interval '2 days'),
  ('a1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'Harbor · music licensing', null,
   null, current_date + 5, 'low', 'todo', 2, '00000000-0000-4000-8000-000000000021', now() - interval '2 days');

alter table public.tasks enable trigger notify_task_changes;
alter table public.tasks enable trigger log_task_activity;

insert into public.sops (workspace_id, id, title, category, content, is_required, created_by)
values
  ('90000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', 'Tidewater style guide', 'editing_workflow',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Natural light, slow push-ins, no whip pans. Captions in Inter, bottom third."}]}]}',
   true, '00000000-0000-4000-8000-000000000021');

insert into public.sop_acknowledgments (sop_id, editor_id, acknowledged_at)
values ('51000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', now() - interval '58 days');

insert into public.announcements (workspace_id, author_id, title, body, is_pinned, created_at)
values
  ('90000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000021', 'Welcome to Tidewater',
   'Harbor Coffee is our first retainer. Reels go out every Tuesday.', true, now() - interval '30 days');

alter table public.announcements enable trigger notify_announcement;

insert into public.applicants (workspace_id, full_name, email, portfolio_url, software, specialties, timezone, hourly_rate, weekly_hours, stage, position, created_at, stage_changed_at)
values
  ('90000000-0000-4000-8000-000000000002', 'Ravi Patel', 'ravi.patel@gmail.com', 'https://vimeo.com/ravipatel', array['DaVinci Resolve'], array['Color grading'],
   'Asia/Kolkata', 20, 30, 'applied', 1, now() - interval '3 hours', now() - interval '3 hours');

insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id, created_at)
values
  ('90000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000011', 'task_assigned', 'New task: Harbor Reel 01 · rough cut',
   'Harbor · Spring Reels', '/tasks/a1000000-0000-4000-8000-000000000001', 'task', 'a1000000-0000-4000-8000-000000000001', now() - interval '2 days');

-- =============================================================================
-- Attendance reports, messages and the client portal (Foundry Media)
-- =============================================================================

-- End-of-shift reports for every finished shift, on the task last worked on.
insert into public.shift_reports (shift_id, editor_id, task_id, work_done, blockers, progress_pct, created_at)
select
  s.id, s.editor_id, l.task_id,
  (array[
    'Rough cut done and uploaded for internal review.',
    'Captions and SFX pass finished, exported v2.',
    'Pulled selects and built the first assembly.',
    'Colour pass on the hero shots, matched the B-camera.',
    'Worked through the Frame.io notes, all resolved.',
    'Hook variations cut, three versions in the review folder.',
    'Sound mix and music edit, levels checked on phone speakers.',
    'Final exports in every aspect ratio, delivered to /05_Exports.'
  ])[1 + abs(hashtext(s.id::text)) % 8],
  case when abs(hashtext(s.id::text || 'b')) % 7 = 0 then
    (array[
      'Waiting on the client''s logo files.',
      'Music licence still pending.',
      'Missing B-roll for the second half.',
      'Need sign-off on the intro before I go further.'
    ])[1 + abs(hashtext(s.id::text || 'c')) % 4]
  end,
  least(100, 15 + abs(hashtext(s.id::text || 'p')) % 86)::smallint,
  s.clock_out_at
from public.shifts s
left join lateral (
  select t.task_id from public.time_logs t where t.shift_id = s.id order by t.started_at desc limit 1
) l on true
where s.clock_out_at is not null;

-- Lucas asked the admins something and got an answer; Maya's question is
-- still waiting. Northwind Fitness wrote in from their client portal.
insert into public.message_threads (id, workspace_id, kind, editor_id, client_id, last_message_at, last_message_preview, last_sender, client_last_read_at, created_at)
values
  ('70000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'editor', '00000000-0000-4000-8000-000000000011', null,
   now() - interval '2 hours 50 minutes', 'Perfect, thanks. I''ll use the brand font on all four.', 'editor', null, now() - interval '3 days'),
  ('70000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'editor', '00000000-0000-4000-8000-000000000012', null,
   now() - interval '35 minutes', 'Could I take Friday afternoon off? I''ll finish the Anthem grade Thursday.', 'editor', null, now() - interval '35 minutes'),
  ('70000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', 'client', null, 'c0000000-0000-4000-8000-000000000001',
   now() - interval '25 minutes', 'Could we see a first cut of Reel 04 by Friday?', 'client', now() - interval '25 minutes', now() - interval '6 days');

insert into public.messages (thread_id, sender, author_id, body, created_at)
values
  ('70000000-0000-4000-8000-000000000001', 'editor', '00000000-0000-4000-8000-000000000011', 'Hi Alex, do the Northwind reels need the new end card, or the old one?', now() - interval '3 days'),
  ('70000000-0000-4000-8000-000000000001', 'admin',  '00000000-0000-4000-8000-000000000001', 'New one. It''s in the asset pack under /Northwind/2026.', now() - interval '3 days' + interval '20 minutes'),
  ('70000000-0000-4000-8000-000000000001', 'editor', '00000000-0000-4000-8000-000000000011', 'Also, brand font for captions or the platform default?', now() - interval '3 hours'),
  ('70000000-0000-4000-8000-000000000001', 'admin',  '00000000-0000-4000-8000-000000000001', 'Brand font, always.', now() - interval '2 hours 55 minutes'),
  ('70000000-0000-4000-8000-000000000001', 'editor', '00000000-0000-4000-8000-000000000011', 'Perfect, thanks. I''ll use the brand font on all four.', now() - interval '2 hours 50 minutes'),
  ('70000000-0000-4000-8000-000000000002', 'editor', '00000000-0000-4000-8000-000000000012', 'Could I take Friday afternoon off? I''ll finish the Anthem grade Thursday.', now() - interval '35 minutes'),
  ('70000000-0000-4000-8000-000000000003', 'client', null, 'Hi team! Loving Reel 03 so far.', now() - interval '6 days'),
  ('70000000-0000-4000-8000-000000000003', 'admin',  '00000000-0000-4000-8000-000000000001', 'Thanks Sarah! Reel 04 is in progress, you''ll see it here as it moves along.', now() - interval '6 days' + interval '1 hour'),
  ('70000000-0000-4000-8000-000000000003', 'client', null, 'Could we see a first cut of Reel 04 by Friday?', now() - interval '25 minutes');

insert into public.message_reads (thread_id, user_id, last_read_at)
values
  ('70000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now() - interval '2 hours 45 minutes'),
  ('70000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', now() - interval '2 hours 50 minutes'),
  ('70000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', now() - interval '35 minutes'),
  ('70000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', now() - interval '6 days' + interval '1 hour');

insert into public.notifications (workspace_id, user_id, type, title, body, link, entity_type, entity_id, created_at)
values
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'new_message', 'Message from Maya Chen',
   'Could I take Friday afternoon off? I''ll finish the Anthem grade Thursday.', '/messages/team/00000000-0000-4000-8000-000000000012',
   'thread', '70000000-0000-4000-8000-000000000002', now() - interval '35 minutes'),
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'new_message', 'Message from Northwind Fitness',
   'Could we see a first cut of Reel 04 by Friday?', '/messages/clients/c0000000-0000-4000-8000-000000000001',
   'thread', '70000000-0000-4000-8000-000000000003', now() - interval '25 minutes');

-- Northwind Fitness's portal link: http://localhost:3000/portal/northwind-demo-portal-0000000000000001
insert into public.client_portals (client_id, token, created_by, created_at, last_viewed_at)
values ('c0000000-0000-4000-8000-000000000001', 'northwind-demo-portal-0000000000000001',
        '00000000-0000-4000-8000-000000000001', now() - interval '7 days', now() - interval '25 minutes');

-- Everything seeded is history: it has already been emailed if it was going
-- to be. (New notifications from here on are emailed as usual.)
update public.notifications set emailed_at = created_at;

-- -----------------------------------------------------------------------------
-- Scheduled jobs → the local dev server. pg_cron calls
-- http://host.docker.internal:3001/api/jobs/notifications with this secret
-- (the app accepts it in development when JOBS_SECRET isn't set).
-- -----------------------------------------------------------------------------
select vault.create_secret('http://host.docker.internal:3001', 'foundry_app_url', 'Where scheduled jobs reach the app');
select vault.create_secret('foundry-local-jobs-secret', 'foundry_jobs_secret', 'Shared secret for the app''s /api/jobs endpoints');
