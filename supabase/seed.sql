-- =============================================================================
-- Foundry · local seed data
--
-- Sign in with any of these (password for all: foundry123):
--   admin@foundrymedia.co   Admin  · Alex Morgan
--   lucas@foundrymedia.co   Editor · Lucas Bennett
--   maya@foundrymedia.co    Editor · Maya Chen
--   diego@foundrymedia.co   Editor · Diego Alvarez
--   priya@foundrymedia.co   Editor · Priya Nair (still onboarding)
--
-- Dates are relative to now(), so the dashboard always looks "live":
-- ~6 months of attendance history, two editors working, one on break.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Users (profiles, editor rows and onboarding checklists come from triggers)
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('foundry123', extensions.gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', u.role),
  jsonb_build_object('full_name', u.full_name, 'timezone', u.tz),
  now() - u.joined, now(), '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@foundrymedia.co', 'Alex Morgan',   'admin',  'America/New_York',    interval '400 days'),
  ('00000000-0000-4000-8000-000000000011'::uuid, 'lucas@foundrymedia.co', 'Lucas Bennett', 'editor', 'America/New_York',    interval '300 days'),
  ('00000000-0000-4000-8000-000000000012'::uuid, 'maya@foundrymedia.co',  'Maya Chen',     'editor', 'Europe/London',       interval '260 days'),
  ('00000000-0000-4000-8000-000000000013'::uuid, 'diego@foundrymedia.co', 'Diego Alvarez', 'editor', 'America/Mexico_City', interval '220 days'),
  ('00000000-0000-4000-8000-000000000014'::uuid, 'priya@foundrymedia.co', 'Priya Nair',    'editor', 'Asia/Kolkata',        interval '14 days')
) as u(id, email, full_name, role, tz, joined);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), u.created_at, now()
from auth.users u
where u.email like '%@foundrymedia.co';

update public.profiles set phone = '+1 555 0100', last_seen_at = now()
where id = '00000000-0000-4000-8000-000000000001';

update public.app_settings set
  admin_email = 'admin@foundrymedia.co',
  asset_pack_url = 'https://drive.google.com/drive/folders/foundry-editor-asset-pack',
  frameio_invite_url = 'https://app.frame.io/invite/foundry-media',
  contract_template_url = 'https://drive.google.com/drive/folders/foundry-editor-contracts'
where id = 1;

-- Editor details
update public.editors e set
  software = v.software,
  specialties = v.specialties,
  hourly_rate = v.rate,
  weekly_hours = v.hours,
  created_at = now() - v.joined,
  onboarding_completed_at = case when v.onboarded then now() - v.joined + interval '3 days' end
from (values
  ('00000000-0000-4000-8000-000000000011'::uuid, array['Premiere Pro', 'After Effects'],   array['Short-form', 'Motion graphics'],   35.00, 40, true,  interval '300 days'),
  ('00000000-0000-4000-8000-000000000012'::uuid, array['DaVinci Resolve', 'Premiere Pro'], array['Color grading', 'Long-form YouTube'], 42.00, 32, true,  interval '260 days'),
  ('00000000-0000-4000-8000-000000000013'::uuid, array['Premiere Pro', 'CapCut'],          array['Short-form', 'Paid social ads'],    28.00, 40, true,  interval '220 days'),
  ('00000000-0000-4000-8000-000000000014'::uuid, array['Final Cut Pro', 'After Effects'],  array['Motion graphics', 'Documentary'],   38.00, 25, false, interval '14 days')
) as v(id, software, specialties, rate, hours, onboarded, joined)
where e.id = v.id;

insert into public.editor_payment_details (editor_id, method, details)
values
  ('00000000-0000-4000-8000-000000000011', 'bank',   '{"account_name": "Lucas Bennett", "bank_name": "Chase", "account_number": "•••• 4821", "routing": "021000021", "country": "United States"}'),
  ('00000000-0000-4000-8000-000000000012', 'wise',   '{"email": "maya.chen@hey.com", "currency": "GBP"}'),
  ('00000000-0000-4000-8000-000000000013', 'paypal', '{"email": "diego.alvarez@gmail.com"}'),
  ('00000000-0000-4000-8000-000000000014', 'wise',   '{"email": "priya.nair@outlook.com", "currency": "INR"}');

-- Onboarding: the first three are done; Priya is halfway. (Set after the
-- inserts above, which tick steps automatically.)
update public.editor_checklist_items i
set is_done = true, done_at = e.onboarding_completed_at - interval '1 hour'
from public.editors e
where e.id = i.editor_id and e.onboarding_completed_at is not null;

update public.editor_checklist_items
set is_done = (key in ('contract_nda', 'payment_details', 'frameio')),
    done_at = case when key in ('contract_nda', 'payment_details', 'frameio') then now() - interval '10 days' end
where editor_id = '00000000-0000-4000-8000-000000000014';

-- -----------------------------------------------------------------------------
-- Leads & clients
-- -----------------------------------------------------------------------------
insert into public.leads (id, name, company, email, phone, project_type, budget_range, deadline, reference_links, notes, created_at)
values
  ('e0000000-0000-4000-8000-000000000001', 'Hannah Lee', 'Bright Path Academy', 'hannah@brightpath.edu', '+1 555 0141',
   'YouTube long-form', '$2k–5k / month', current_date + 45,
   array['https://youtube.com/@brightpath'], 'Looking for 4 videos per month, course trailers too.', now() - interval '5 hours'),
  ('e0000000-0000-4000-8000-000000000002', 'Omar Haddad', 'Cedar & Stone Realty', 'omar@cedarstone.com', '+1 555 0172',
   'Property walkthroughs', '$1k–2k / month', current_date + 30,
   array['https://instagram.com/cedarstone'], 'Weekly listing reels, vertical.', now() - interval '3 days');

insert into public.clients (
  id, lead_id, contact_name, company, email, phone, stage, position, stage_changed_at,
  project_type, budget_range, drive_folder_url, contract_path, deposit_status, final_status,
  call_notes, created_at
)
values
  ('c0000000-0000-4000-8000-000000000001', null, 'Sarah Kim', 'Northwind Fitness', 'sarah@northwindfit.com', '+1 555 0110',
   'active_client', 1, now() - interval '120 days', 'Short-form social', '$5k+ / month',
   'https://drive.google.com/drive/folders/northwind', 'c0000000-0000-4000-8000-000000000001/contract.pdf', 'paid', 'unpaid',
   'Wants punchy hooks in first 2s. Brand colors: navy + lime.', now() - interval '150 days'),
  ('c0000000-0000-4000-8000-000000000002', null, 'Marcus Webb', 'Lumen Coffee Co.', 'marcus@lumencoffee.com', '+1 555 0120',
   'active_client', 2, now() - interval '90 days', 'YouTube series + ads', '$2k–5k / month',
   'https://drive.google.com/drive/folders/lumen', 'c0000000-0000-4000-8000-000000000002/contract.pdf', 'paid', 'paid',
   'Documentary tone, warm grade. Episodes ~12 min.', now() - interval '110 days'),
  ('c0000000-0000-4000-8000-000000000003', null, 'Nina Park', 'Atlas Outdoor', 'nina@atlasoutdoor.co', '+1 555 0130',
   'kickoff', 1, now() - interval '2 days', 'Campaign launch', '$5k+ project',
   'https://drive.google.com/drive/folders/atlas', 'c0000000-0000-4000-8000-000000000003/contract.pdf', 'paid', 'unpaid',
   'Kickoff Thursday. Needs 3 hero cuts + 12 cutdowns.', now() - interval '20 days'),
  ('c0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', 'Hannah Lee', 'Bright Path Academy', 'hannah@brightpath.edu', '+1 555 0141',
   'new_lead', 1, now() - interval '5 hours', 'YouTube long-form', '$2k–5k / month',
   null, null, 'unpaid', 'unpaid', null, now() - interval '5 hours'),
  ('c0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000002', 'Omar Haddad', 'Cedar & Stone Realty', 'omar@cedarstone.com', '+1 555 0172',
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
  full_name, email, portfolio_url, software, specialties, timezone, hourly_rate, weekly_hours,
  availability_notes, stage, position, rating, test_edit_url, test_submission_url, admin_notes,
  created_at, stage_changed_at
)
values
  ('Jonah Reyes',  'jonah.reyes@gmail.com', 'https://vimeo.com/jonahreyes', array['Premiere Pro'], array['Short-form'],
   'Asia/Manila', 18, 40, 'Weekdays, overlapping US mornings.', 'applied', 1, null, null, null, null,
   now() - interval '1 day', now() - interval '1 day'),
  ('Elena Varga',  'elena.v@proton.me', 'https://elenavarga.com', array['DaVinci Resolve', 'After Effects'], array['Color grading', 'Paid social ads'],
   'Europe/Budapest', 32, 30, null, 'test_edit_sent', 1, 4,
   'https://drive.google.com/drive/folders/foundry-test-edit', null, 'Strong grading reel. Sent the 30s ad test.',
   now() - interval '6 days', now() - interval '4 days'),
  ('Sofia Marin',  'sofia.marin@gmail.com', 'https://youtube.com/@sofiacuts', array['Premiere Pro', 'CapCut'], array['Short-form', 'Long-form YouTube'],
   'America/Bogota', 22, 40, 'Full time from next month.', 'test_submitted', 1, 4,
   'https://drive.google.com/drive/folders/foundry-test-edit', 'https://vimeo.com/sofiamarin/foundry-test', null,
   now() - interval '9 days', now() - interval '1 day'),
  ('Kwame Asante', 'kwame@asante.studio', 'https://asante.studio/reel', array['Premiere Pro', 'After Effects'], array['Motion graphics'],
   'Africa/Accra', 26, 35, null, 'interview', 1, 5,
   'https://drive.google.com/drive/folders/foundry-test-edit', 'https://frame.io/share/kwame-test',
   'Test edit was excellent, great kinetic type. Interview booked for Thursday.',
   now() - interval '12 days', now() - interval '2 days'),
  ('Tom Becker',   'tom.becker@web.de', null, array['iMovie'], array['Vlogs'],
   'Europe/Berlin', 60, 10, null, 'rejected', 1, 2, null, null, 'No portfolio, rate well above budget.',
   now() - interval '20 days', now() - interval '18 days');

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
  ('b0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000014'),
  ('b0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000011'),
  ('b0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000013');

-- -----------------------------------------------------------------------------
-- Tasks: current work
-- Seeded tasks are history, not news: no "New task" notifications or feed
-- entries for them (the notifications that matter are inserted below).
-- -----------------------------------------------------------------------------
alter table public.tasks disable trigger notify_task_changes;
alter table public.tasks disable trigger log_task_activity;

insert into public.tasks (id, project_id, title, description, assignee_id, due_date, priority, status, revision_count, progress_pct, is_trial, position, created_by, created_at)
values
  -- Lucas
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Reel 04 · rough cut',         'Hook in first 2s, captions burned in.', '00000000-0000-4000-8000-000000000011', current_date,     'high',   'in_progress', 0, 40, false, 1, '00000000-0000-4000-8000-000000000001', now() - interval '6 days'),
  ('a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Reel 03 · captions & SFX',    null,                                    '00000000-0000-4000-8000-000000000011', current_date + 1, 'medium', 'for_review',  0, 90, false, 1, '00000000-0000-4000-8000-000000000001', now() - interval '8 days'),
  ('a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'Origins Ep.2 · assembly',     'Selects are in /02_Selects.',           '00000000-0000-4000-8000-000000000011', current_date + 3, 'medium', 'todo',        0, 0,  false, 1, '00000000-0000-4000-8000-000000000001', now() - interval '3 days'),
  ('a0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'Reel 02 · revisions',         'Client wants a faster intro.',          '00000000-0000-4000-8000-000000000011', current_date - 1, 'urgent', 'revisions',   1, 70, false, 1, '00000000-0000-4000-8000-000000000001', now() - interval '12 days'),
  -- Maya
  ('a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'Anthem · color grade',        'Warm, filmic. LUT in Drive.',           '00000000-0000-4000-8000-000000000012', current_date + 2, 'high',   'in_progress', 0, 60, false, 1, '00000000-0000-4000-8000-000000000001', now() - interval '5 days'),
  ('a0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000003', 'Origins Ep.1 · final export', null,                                    '00000000-0000-4000-8000-000000000012', current_date,     'high',   'for_review',  1, 95, false, 2, '00000000-0000-4000-8000-000000000001', now() - interval '9 days'),
  ('a0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000002', 'Anthem · client notes v2',    null,                                    '00000000-0000-4000-8000-000000000012', current_date + 4, 'medium', 'todo',        0, 0,  false, 2, '00000000-0000-4000-8000-000000000001', now() - interval '1 day'),
  -- Diego
  ('a0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', 'Reel 05 · hook variations',   'Three alternate hooks, same body.',     '00000000-0000-4000-8000-000000000013', current_date + 1, 'medium', 'in_progress', 0, 25, false, 2, '00000000-0000-4000-8000-000000000001', now() - interval '4 days'),
  ('a0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000004', 'Spring Launch · selects',     null,                                    '00000000-0000-4000-8000-000000000013', current_date + 5, 'medium', 'todo',        0, 0,  false, 3, '00000000-0000-4000-8000-000000000001', now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001', 'Reel 01 · subtitle fixes',    'Typos flagged in Frame.io.',            '00000000-0000-4000-8000-000000000013', current_date - 2, 'high',   'todo',        0, 0,  false, 4, '00000000-0000-4000-8000-000000000001', now() - interval '7 days'),
  -- Priya
  ('a0000000-0000-4000-8000-000000000011', null,                                   'Trial task · 30s product teaser', 'Use the sample footage in the asset pack.', '00000000-0000-4000-8000-000000000014', current_date + 2, 'medium', 'in_progress', 0, 30, true,  1, '00000000-0000-4000-8000-000000000001', now() - interval '6 days'),
  ('a0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000004', 'Spring Launch · motion toolkit', 'Lower thirds + end card.',             '00000000-0000-4000-8000-000000000014', current_date + 6, 'low',    'todo',        0, 0,  false, 2, '00000000-0000-4000-8000-000000000001', now() - interval '2 days');

insert into public.subtasks (task_id, title, is_done, position)
values
  ('a0000000-0000-4000-8000-000000000001', 'Pull selects',          true,  1),
  ('a0000000-0000-4000-8000-000000000001', 'Rough assembly',        true,  2),
  ('a0000000-0000-4000-8000-000000000001', 'Captions',              false, 3),
  ('a0000000-0000-4000-8000-000000000001', 'Music + SFX pass',      false, 4),
  ('a0000000-0000-4000-8000-000000000005', 'Primary balance',       true,  1),
  ('a0000000-0000-4000-8000-000000000005', 'Look development',      true,  2),
  ('a0000000-0000-4000-8000-000000000005', 'Shot matching',         false, 3);

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
insert into public.task_comments (task_id, author_id, body, mentions, created_at)
values
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Client wants a faster intro. Cut the first 3 seconds and open on the product shot.', '{}', now() - interval '20 hours'),
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000011', 'On it. I''ll have v2 up this afternoon.', '{}', now() - interval '19 hours'),
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '@Alex Morgan should the captions follow the brand font or the platform default?', '{00000000-0000-4000-8000-000000000001}', now() - interval '3 hours'),
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Brand font, please. It''s in the asset pack.', '{}', now() - interval '2 hours 40 minutes');
alter table public.task_comments enable trigger notify_task_mentions;

insert into public.task_attachments (task_id, kind, url, label, added_by, created_at)
values
  ('a0000000-0000-4000-8000-000000000002', 'link', 'https://app.frame.io/reviews/northwind-reel-03-v2', 'Frame.io review · v2', '00000000-0000-4000-8000-000000000011', now() - interval '1 hour 10 minutes'),
  ('a0000000-0000-4000-8000-000000000005', 'link', 'https://drive.google.com/drive/folders/northwind-anthem/luts', 'LUT folder', '00000000-0000-4000-8000-000000000001', now() - interval '5 days');

-- -----------------------------------------------------------------------------
-- Attendance history: one shift per scheduled workday (not today), two task
-- blocks split by a break. Values are deterministic per editor/day.
-- -----------------------------------------------------------------------------
with days as (
  select
    e.id as editor_id,
    p.timezone as tz,
    d::date as work_date
  from public.editors e
  join public.profiles p on p.id = e.id
  cross join generate_series(current_date - 182, current_date - 1, interval '1 day') as d
  where extract(isodow from d)::smallint = any (e.work_days)
    and d::date >= (e.created_at at time zone p.timezone)::date
    and abs(hashtext(e.id::text || d::text)) % 100 >= 6          -- ~6% days off
),
shaped as (
  select
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
  insert into public.shifts (editor_id, clock_in_at, clock_out_at, work_date, work_seconds, break_seconds, ended_by)
  select
    editor_id, start_at, start_at + block1 + brk + block2, work_date,
    extract(epoch from block1 + block2)::integer,
    extract(epoch from brk)::integer,
    'editor'
  from shaped
  returning id, editor_id, work_date
)
insert into public.time_logs (editor_id, shift_id, task_id, started_at, ended_at)
select s.editor_id, s.id, pick.task_id, b.started_at, b.ended_at
from new_shifts s
join shaped sh on sh.editor_id = s.editor_id and sh.work_date = s.work_date
cross join lateral (values
  (1, sh.start_at,                     sh.start_at + sh.block1),
  (2, sh.start_at + sh.block1 + sh.brk, sh.start_at + sh.block1 + sh.brk + sh.block2)
) as b(block, started_at, ended_at)
left join lateral (
  select t.id as task_id
  from public.tasks t
  where t.assignee_id = s.editor_id
    and t.created_at::date <= s.work_date
    and (t.completed_at is null or t.completed_at::date >= s.work_date)
  order by md5(t.id::text || s.work_date::text || b.block::text)
  limit 1
) as pick on true;

-- -----------------------------------------------------------------------------
-- Today: Lucas and Diego are working, Maya is on a break, Priya is off.
-- -----------------------------------------------------------------------------
insert into public.shifts (id, editor_id, clock_in_at, work_date)
values
  ('d0000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000011', now() - interval '2 hours 15 minutes', (now() at time zone 'America/New_York')::date),
  ('d0000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000012', now() - interval '3 hours 40 minutes', (now() at time zone 'Europe/London')::date),
  ('d0000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000013', now() - interval '45 minutes',         (now() at time zone 'America/Mexico_City')::date);

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
where e.id = v.id;

update public.profiles p set last_seen_at = now() - v.ago
from (values
  ('00000000-0000-4000-8000-000000000011'::uuid, interval '1 minute'),
  ('00000000-0000-4000-8000-000000000012'::uuid, interval '6 minutes'),
  ('00000000-0000-4000-8000-000000000013'::uuid, interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000014'::uuid, interval '20 hours')
) as v(id, ago)
where p.id = v.id;

-- -----------------------------------------------------------------------------
-- Announcements, meetings, SOPs, ideas
-- -----------------------------------------------------------------------------
insert into public.meetings (id, title, starts_at, duration_minutes, meeting_url, agenda, created_by)
values
  ('f0000000-0000-4000-8000-000000000001', 'Weekly team sync',
   date_trunc('week', now()) + interval '7 days 15 hours', 30, 'https://meet.google.com/foundry-sync',
   E'1. Wins of the week\n2. Blockers\n3. Next week''s deliveries', '00000000-0000-4000-8000-000000000001');

insert into public.announcements (author_id, title, body, is_pinned, meeting_id, created_at)
values
  ('00000000-0000-4000-8000-000000000001', 'Welcome to Foundry',
   'This is our new home base. Start work from the top bar, keep task status up to date, and check here for updates.',
   true, null, now() - interval '14 days'),
  ('00000000-0000-4000-8000-000000000001', 'Meeting: Weekly team sync',
   'Monday sync. Bring one win and one blocker.', false, 'f0000000-0000-4000-8000-000000000001', now() - interval '1 day');

insert into public.meeting_rsvps (meeting_id, user_id, status)
values
  ('f0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'going'),
  ('f0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'maybe');

insert into public.sops (id, title, category, content, is_required, created_by)
values
  ('50000000-0000-4000-8000-000000000001', 'Editing workflow: from brief to delivery', 'editing_workflow',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Read the brief, pull selects, rough cut, internal review, client review, delivery."}]}]}',
   true, '00000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', 'Reviewing in Frame.io', 'frameio_review',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Upload versions to the project folder, resolve every comment before re-uploading."}]}]}',
   true, '00000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000003', 'File naming & delivery', 'file_naming_delivery',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"CLIENT_PROJECT_DELIVERABLE_v01.mp4. Deliver to /05_Exports."}]}]}',
   false, '00000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000004', 'Communication norms', 'communication',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Flag blockers early. Reply to mentions within 4 working hours."}]}]}',
   false, '00000000-0000-4000-8000-000000000001');

insert into public.sop_acknowledgments (sop_id, editor_id, acknowledged_at)
select s.id, e.id, now() - interval '150 days'
from public.sops s
cross join public.editors e
where s.is_required and e.onboarding_completed_at is not null;

insert into public.ideas (author_id, title, body, created_at)
values
  ('00000000-0000-4000-8000-000000000012', 'Shared LUT library', 'One Drive folder with approved LUTs per client.', now() - interval '6 days'),
  ('00000000-0000-4000-8000-000000000001', 'Monthly best-cut showcase', 'Each editor shares their favourite edit of the month.', now() - interval '2 days');

-- -----------------------------------------------------------------------------
-- Activity feed & notifications
-- -----------------------------------------------------------------------------
insert into public.activity_log (actor_id, action, entity_type, entity_id, summary, created_at)
values
  ('00000000-0000-4000-8000-000000000012', 'editor.started_work',  'editor', '00000000-0000-4000-8000-000000000012', 'Maya Chen started working on Anthem · color grade',  now() - interval '3 hours 40 minutes'),
  ('00000000-0000-4000-8000-000000000011', 'editor.started_work',  'editor', '00000000-0000-4000-8000-000000000011', 'Lucas Bennett started working on Reel 03 · captions & SFX', now() - interval '2 hours 15 minutes'),
  ('00000000-0000-4000-8000-000000000011', 'task.status_changed',  'task',   'a0000000-0000-4000-8000-000000000002', 'Lucas Bennett moved Reel 03 · captions & SFX to For Review', now() - interval '1 hour 10 minutes'),
  ('00000000-0000-4000-8000-000000000013', 'editor.started_work',  'editor', '00000000-0000-4000-8000-000000000013', 'Diego Alvarez started working on Reel 05 · hook variations', now() - interval '45 minutes'),
  ('00000000-0000-4000-8000-000000000012', 'editor.took_break',    'editor', '00000000-0000-4000-8000-000000000012', 'Maya Chen is on a break',                            now() - interval '12 minutes'),
  ('00000000-0000-4000-8000-000000000001', 'client.stage_changed', 'client', 'c0000000-0000-4000-8000-000000000003', 'Atlas Outdoor moved to Kickoff',                     now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000012', 'task.status_changed',  'task',   'a0000000-0000-4000-8000-000000000006', 'Maya Chen moved Origins Ep.1 · final export to For Review', now() - interval '26 hours');

insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id, created_at)
values
  ('00000000-0000-4000-8000-000000000001', 'task_for_review', 'Ready for review: Reel 03 · captions & SFX', 'Lucas Bennett', '/tasks/a0000000-0000-4000-8000-000000000002', 'task', 'a0000000-0000-4000-8000-000000000002', now() - interval '1 hour 10 minutes'),
  ('00000000-0000-4000-8000-000000000011', 'revision_requested', 'Revisions requested: Reel 02', 'Client wants a faster intro.', '/tasks/a0000000-0000-4000-8000-000000000004', 'task', 'a0000000-0000-4000-8000-000000000004', now() - interval '20 hours'),
  ('00000000-0000-4000-8000-000000000014', 'task_assigned',   'New task: Spring Launch · motion toolkit', 'Due in 6 days', '/tasks/a0000000-0000-4000-8000-000000000012', 'task', 'a0000000-0000-4000-8000-000000000012', now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000014', 'task_assigned',   'Your trial task: Trial task · 30s product teaser', null, '/onboarding', 'task', 'a0000000-0000-4000-8000-000000000011', now() - interval '6 days'),
  ('00000000-0000-4000-8000-000000000001', 'mention',         'Lucas Bennett mentioned you on Reel 04 · rough cut', '@Alex Morgan should the captions follow the brand font or the platform default?', '/tasks/a0000000-0000-4000-8000-000000000001', 'task', 'a0000000-0000-4000-8000-000000000001', now() - interval '3 hours');
