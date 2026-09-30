# ReEdit

Run a video editing team from one place: client onboarding, hiring and onboarding editors, projects and tasks, live attendance and timesheets, team messages and announcements, SOPs, and a private portal for each client. Each company gets its own **workspace**; one account can belong to several. Foundry Media is the first workspace. Hosted at `app.foundrymedia.co`.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (Postgres, Auth, Storage, Realtime, RLS, pg_cron, pg_net, Vault) · Tiptap · Brevo · Vercel

---

## Local development

### Prerequisites

- **Node.js 20+**
- **Docker Desktop**, which runs the local Supabase stack. On Windows it needs WSL 2: run `wsl --install` in an **admin** terminal, reboot, then start Docker Desktop once.

### 1. Install

```bash
npm install
```

### 2. Start Supabase

```bash
npm run db:start      # first run downloads the images (a few minutes)
```

This starts Postgres, Auth, Storage, Realtime, Studio and a local mail catcher. It then applies `supabase/migrations/*` and runs `supabase/seed.sql`.

### 3. Configure the app

```bash
cp .env.example .env.local
npm run db:status     # prints the local URL and keys
```

Copy the API URL, publishable key and secret key into `.env.local`.

### 4. Run

```bash
npm run dev           # http://localhost:3001
```

### Seed logins

The password for all of these is `foundry123`.

| Email | Workspace and role | Notes |
| --- | --- | --- |
| `admin@foundrymedia.co` | Foundry Media · Owner | Alex Morgan |
| `lucas@foundrymedia.co` | Foundry Media and Tidewater Films · Editor | Working right now. Try the workspace switcher. |
| `maya@foundrymedia.co` | Foundry Media · Editor | On a break |
| `diego@foundrymedia.co` | Foundry Media · Editor | Working right now |
| `priya@foundrymedia.co` | Foundry Media · Editor, onboarding | Limited access. 3 of 8 steps, test edit in progress, interview booked. |
| `nora@tidewater.test` | Tidewater Films · Owner | A second, smaller company |
| `sam@example.com` | None yet | Lands on the welcome page. Invitation code `TDWT-SAMR-2345` joins Tidewater Films. |

Kwame Asante's invitation to Foundry Media (code `FDRY-KWAM-E234`) is waiting too. New sign-ups confirm their email through Mailpit.

Maya has a question waiting in **Messages → Team**, and Northwind Fitness (a client) has written in from their portal: http://localhost:3001/portal/northwind-demo-portal-0000000000000001

The seed dates are relative to the moment you run it, so the dashboard always shows about 6 months of history plus "today". Re-run `npm run db:reset` to refresh them.

### Useful local URLs

- **Supabase Studio** (browse data): http://127.0.0.1:54323
- **Mailpit** (every email sent locally: sign-up confirmations, password resets, lead and applicant alerts, invitations, interviews, notification emails, replies to clients): http://127.0.0.1:54324
- **Public client intake form** (no login): http://localhost:3001/intake/foundry-media
- **Public editor application form** (no login): http://localhost:3001/apply/foundry-media
- **Northwind Fitness's client portal** (no login): http://localhost:3001/portal/northwind-demo-portal-0000000000000001

Locally, the database's scheduled jobs reach the dev server at `http://host.docker.internal:3001` (set in `seed.sql`). If you run the app on another port, update the `foundry_app_url` secret in Vault (Studio → Vault) so notification emails still go out.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run db:start` / `db:stop` | Start / stop local Supabase |
| `npm run db:reset` | Recreate the local DB from migrations + seed |
| `npm run db:types` | Regenerate `src/types/database.ts` from the local DB |

---

## Project structure

```
supabase/
  migrations/          schema → core behaviour → access control (RLS, storage, realtime)
  seed.sql             two demo workspaces (Foundry Media, Tidewater Films) plus a user with none
  templates/           branded auth emails (sign-up confirmation, password reset)
src/
  app/
    (auth)/            sign in, sign up, welcome (create or join a workspace), join, passwords
    (public)/          a workspace's intake and application forms, by link name (no login)
    (portal)/          a client's private project portal, by link (no login)
    api/jobs/          endpoints the database's scheduled jobs call (notification emails)
    (app)/             signed-in app: dashboard, clients, editors, projects, tasks, attendance, messages, SOPs, ...
    auth/confirm/      landing route for email links
    w/[workspaceId]/   switch workspace, then open a page (links in emails)
  components/
    ui/                shadcn primitives (restyled)
    layout/            sidebar, top bar, command menu (Ctrl+K), notifications, user menu
    theme/             light/dark provider, accent picker, server-rendered accent style
    presence/          live Online/Offline via Supabase Realtime Presence
    shared/            panels, KPI tiles, status chips, avatars, empty states
  features/<module>/   module components + server queries
  lib/                 supabase clients, auth helpers, theme maths, dates, status
  proxy.ts             session refresh + sign-in redirect (Next 16's "middleware")
  types/database.ts    generated Supabase types
```

## How it works

### Workspaces

- Anyone can **sign up** (email and password, or Continue with Google). New email accounts confirm their address first.
- The **welcome page** (`/welcome`) is where people without a workspace land. They either **start their own workspace** (they become its owner) or **join a team** with the invitation code from their email.
- One account can belong to several workspaces. The **switcher** at the top of the sidebar changes the one in use, and other open tabs follow. Links in emails go through `/w/<workspace id>`, which switches first.
- Everything belongs to a workspace, and people only ever see the one they're working in.

### Roles and security

- **Owner / Admin:** full access to their workspace. The owner created it and can't be removed or demoted.
- **Editor, onboarding:** joined with an invitation and waiting for approval. Only their dashboard, Onboarding, SOPs and Settings (profile).
- **Editor, approved:** their own tasks, the projects they're on (including who else is on the team, but not the client's contact details), their attendance, announcements, a private conversation with the admins, and SOPs.
- **Clients:** never log in. They use the workspace's public intake form, and follow their work in their private portal.

Row Level Security enforces this on every table:
- One rule on every table keeps rows to the current workspace (`20260929000003_workspace_access.sql`).
- A second keeps candidates still onboarding to their own onboarding data and test edit (`20260929000005_onboarding_gate.sql`).
- Pages and server actions check the same (`requireUser()` is deny-by-default for onboarding editors).

A few rules sit in database triggers so no client can get around them:
- Editors can move their tasks only as far as **For Review**. Only an admin marks a task Done, requests Revisions or reopens a Done task.
- Only approved editors can be given real work. Rows can't move between workspaces, and child rows always take their parent's workspace.
- Nobody changes their own role or access, and people can only switch to workspaces they belong to.
- Attendance rows are read-only to editors and are written only by database functions. Nobody is clocked in at two workspaces at once.
- Messages are written only through database functions, which check who may write where. Editors read only their own conversation.

### Client onboarding

1. A lead submits the workspace's public form at `/intake/<workspace link name>`. Spam is filtered by a honeypot field, a signed timing token and per-email and per-workspace rate limits.
2. The lead lands at the top of **New Lead**. Admins get an in-app notification and an email.
3. Move clients through the pipeline by dragging cards or using a card's **Move to** menu, which is easier on a phone.
4. At **Contract Signed** the 6-step onboarding checklist appears. Four steps tick themselves: contract uploaded, deposit paid, Drive link added, editor assigned.
5. At **Kickoff** ReEdit asks you to create the client's first project.

Contract PDFs go to a private storage bucket and open through short-lived signed links.

### Editor hiring and onboarding

1. **Share your application link**, `/apply/<workspace link name>` (Applicants → Application form link). It has the same spam protection as the intake form, plus one application per email every 30 days. Turn **Accepting applications** off in Settings to close it.
2. Applicants land at the top of **Applied**, and admins get a notification and an email. Move the promising ones to **Shortlisted**, rate them (1–5) and keep private notes.
3. **Invite to join** emails them an **invitation code** (`XXXX-XXXX-XXXX`, good for 14 days) and moves them to **Invited**. You can copy the link, resend it or revoke it. **Reject** can send a short, polite note.
4. They sign up (or sign in) and enter the code on the welcome page. The email's button fills it in. They join as an editor, **still onboarding**, and move to **Joined**. Admins are notified.
5. **Onboarding** (`/onboarding`), with limited access until you approve them:
   - **Get set up:** contract and NDA, payment details, required SOPs (these tick themselves); Frame.io and the asset pack (they tick these).
   - **Test edit:** set a test edit template in **Settings → Test edit**, and every joiner gets it straight away. Otherwise assign one from their profile. They hand it in with a link.
   - **Test review:** on their profile, pass it or request changes with feedback. They see the feedback and send a new version.
   - **Interview:** book a time and meeting link from their profile. They get a notification, an email, and an **Add to calendar** file. Mark it **Passed** (ticks the step) or **Didn't pass**.
6. When every step is done, admins are told they're **ready for approval**. **Approve** gives them full access, with an email. **Don't take on** ends their access, optionally with a polite email. You can approve before every step is done; it asks first.

Also on an editor's profile: private notes (admins only), onboarding steps you can tick by hand, skills, rate and schedule, and an **Active** switch. Inactive editors are hidden from assignment and the live board. **Editors → Invite editor** invites someone who didn't apply. Signed contracts and NDAs sit in a private bucket, under the workspace, that only the editor and the workspace's admins can open.

The contract and NDA templates, Frame.io invite and asset pack links are set in **Settings → Workspace**.

### Projects and tasks

- **Projects** belong to a client. Each one has a deadline, a team of editors, Drive and Frame.io links, deliverable specs (format, aspect ratio, length) and a status from Brief Received to Delivered.
  - Create a project from the Projects page, the client's page, or the Kickoff prompt.
  - The project page shows its tasks, team, hours logged and history.
  - An editor given a task on a project joins that project's team automatically.
- **Tasks** (admins): one page with four views over the same filters. The filters are editor, client, project, status, priority, due date and a title search. Filters live in the URL, so any view can be bookmarked or shared.
  - **Kanban:** drag between To Do → In Progress → For Review → Revisions → Done. Dropping on Revisions asks what to change. That feedback is posted as a comment and sent with the editor's notification.
  - **List:** a sortable table.
  - **Calendar:** tasks by due date. Drag a task to another day to reschedule it, or use + on a day to add one. Phones get a day-by-day agenda instead.
  - **By Editor:** each editor's open work side by side, with overdue counts. Drag a card to another editor to reassign it.
  - Every card also has a **Move to / Assign to** menu, which is easier on a phone.
- **Task page:** description, subtasks, links and files, and comments with **@mentions**.
  - Typing @ suggests the people who can open the task: admins and the assignee.
  - Files go to a private bucket and open through short-lived links.
  - Admins get an **Approve / Request revisions** box when work is handed in.
- **My Tasks** (editors): overdue, today and upcoming, with **Start** and **Send for review** buttons, plus a board view.
  - Editors can move their own tasks only as far as For Review. The database also stops them from reopening a Done task.

Editors hear about new assignments and requested revisions, admins hear when work is ready for review, and anyone @mentioned is notified. Status changes, reassignments and new tasks appear in the activity feed. Reminders and email: see **Notifications and email**.

### ClickUp

- **Workspace → ClickUp** (owners and admins): paste a ClickUp personal API token (ClickUp → avatar → Settings → Apps). ReEdit sees what that person can see, and moves made here show in ClickUp as theirs, so use the owner's or an admin's.
- **Link a List** (a "pipeline") to a new or existing project. Pick the status where syncing starts (e.g. Ready to edit) and confirm each ClickUp status's stage. ClickUp's statuses become the workspace's task statuses; on the first link they can replace ReEdit's own.
- Tasks come in once they reach the start status. Tasks already finished (a Done-stage status) and subtasks stay in ClickUp.
- **ClickUp owns what a task is.** Its title, description, due date, priority and assignee come from ClickUp, and the database won't let anyone change them here. Assignees are matched to editors by email. New tasks for a linked project are added in ClickUp. Subtasks, comments, files and time stay ReEdit-only.
- **Status goes both ways.** A move here (a drag, Start work, a review) is queued in `clickup_outbox`. The database then calls `/api/jobs/clickup` through `pg_net`, retrying every minute. A move to a status the task's List doesn't have is refused.
- ClickUp's changes arrive through a webhook at `/api/webhooks/clickup`, registered on connect and checked against its signature. It needs a public `https` address, so locally use **Sync now** on a pipeline, which also catches up on anything missed.

### Attendance

- **Online / Offline** means ReEdit is open, tracked with Supabase Realtime Presence.
- **Working / On break** is the editor's own clock, in the top bar:
  - **Start work** and pick the task (or "no specific task"). A To Do task moves to In Progress.
  - While working: **Switch task** (the clock moves with you), **Take a break**, **Stop work**.
  - **Stop work** asks for the end-of-shift report: what got done, anything blocking (admins are notified), and progress on the task. If a shift ran for hours, they can set when they actually stopped.
- **Attendance** page, for admins:
  - **Live board:** everyone's status right now, what they're on, today's hours and breaks, this week against their planned hours, and who hasn't started. **End shift** stops a shift someone left running, now or at an earlier time, and tells them.
  - **Daily log:** each day's shifts with their reports, plus who was scheduled but didn't work.
  - **Timesheets:** hours per person per day for a week, with totals and planned hours.
  - **Hours:** time per client project and task, and per editor, for any range.
  - **Export CSV** on every view (shifts with reports, timesheet, hours).
- Editors get **My time** (today, this week, the last two weeks of shifts and reports), their timesheet and their hours, with the same exports.
- Work days, start time and weekly hours are set on each editor's profile. **Settings → Workspace** sets the grace period before a missed start is flagged.

### Messages

- **Announcements** (everyone): admins post, edit, pin and remove them. Everyone is notified, can react and comment, and the Messages badge counts unread ones.
- **Team:** each editor has one private conversation with the workspace's admins, for questions, time off, anything that doesn't belong on a task. Admins see every editor's; an editor sees only their own. New messages arrive live and are marked read when opened.
- **Clients:** one conversation per client, with the client writing from their portal. Replies show in the portal, and the client gets an email with a link (replies close together share one email).
- Unread conversations show on the Messages tabs and in the sidebar. While a message notification is unread, newer messages in the same conversation update it rather than piling up.

### Client portal

- On a client's page, **Client portal → Create portal link** gives them a private page (no login). **Make a new link** replaces it (the old one stops working straight away); **Turn off** closes it.
- **Share with client** on a project page copies the same link, opened on that project.
- The portal shows every task on the client's projects as an **overview** (progress per project, what's coming up, recently finished, anything waiting for their review), a **board**, a **list** or a **calendar**, optionally for one project, plus **Messages** with the team.
- Clients see each task's title, status, priority, due date and checklist progress. They never see descriptions, comments, files, hours or who is editing.
- The link is the key: pages are marked noindex and send no referrer. The portal refreshes itself every 30 seconds while open.

### SOPs

Admins write SOPs in a rich-text editor (headings, lists, links, quotes, code) at **SOPs → New SOP**, file them by category, and mark them **Published** (drafts are admin-only) and **Required reading** (part of every new editor's onboarding). The list shows how many editors have read each one. When an SOP changes a lot, **Ask everyone to read it again** clears the read receipts.

### Notifications and email

- Everything shows in the **bell**, live.
- **Reminders**, checked every five minutes by `pg_cron`, each sent once:
  - **Due tomorrow:** to the editor, from 9:00 their time.
  - **Overdue:** to the editor and the admins.
  - **Missed start:** to the admins, when a scheduled editor hasn't started by their start time plus the grace period.
  - **Gone quiet with work overdue:** to the admins, when an editor who started (or is still clocked in) hasn't been seen for two hours.
- **Email** (Brevo): a notification still unread a minute later, while its person isn't looking at ReEdit, is emailed. Several arrive as one digest. Each person picks which kinds they get by email in **Settings → Email notifications**.
  - How it works: every minute `pg_cron` checks for waiting notifications and, if there are any, calls the app's `/api/jobs/notifications` through `pg_net` with a shared secret. The app claims them and sends them. The app's URL and the secret live in Supabase Vault.
  - New leads and applicants, invitations, interviews and approvals are emailed directly when they happen, as before.

### Adjustable colour

Every user can pick an accent in **Settings → Appearance**: one of six presets or any hex colour. There is also an option to tint the dark or light background with that hue. Admins set the workspace default, which is also used on its public pages. Sign-in and sign-up use ReEdit's own orange.

One hex value is converted to OKLCH (`src/lib/theme.ts`), clamped for contrast in each mode, and rendered on the server, so the first paint has no flash. Status colours (working, break, online, offline, overdue) never change with the accent.

---

## Deployment (Vercel + hosted Supabase)

1. **Create a Supabase project**, then link it and push the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   Don't run `seed.sql` in production. The first owner signs up in the app and creates their workspace. (An existing single-company database becomes the "Foundry Media" workspace when the workspace migrations run; its earliest admin becomes the owner.)
2. **Configure Supabase Auth** (Authentication settings):
   - Site URL: `https://app.foundrymedia.co`
   - Redirect URLs: `https://app.foundrymedia.co/**`
   - Allow new users to sign up, and require email confirmation.
   - Email templates: paste `supabase/templates/confirmation.html` (Confirm sign up) and `recovery.html` (Reset password).
   - SMTP: use Brevo's SMTP relay (**Brevo → SMTP & API → SMTP**: host `smtp-relay.brevo.com`, port 587, your SMTP login and an SMTP key), so sign-up confirmations come from your domain. **Without custom SMTP, Supabase only emails your own team members**, so nobody else can confirm a sign-up.
   - Google sign-in: under **Sign In / Providers → Google**, turn it on and paste the Google OAuth client ID and secret. In Google Cloud, the OAuth client's **Authorized redirect URIs** must include `https://<ref>.supabase.co/auth/v1/callback`. For local development, also add `http://127.0.0.1:54321/auth/v1/callback`, and put the secret in `.env.local` as `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`.
3. **Deploy to Vercel:** import the repo, then set the variables from `.env.example`, with `NEXT_PUBLIC_SITE_URL=https://app.foundrymedia.co`, a Brevo API key in `BREVO_API_KEY`, and a long random `JOBS_SECRET`.
4. **Domain:** add `app.foundrymedia.co` to the Vercel project, and verify the sending domain (or at least the `EMAIL_FROM` sender) in Brevo.
5. **Scheduled jobs:** the migrations turn on `pg_cron` and `pg_net` and schedule the reminder and email jobs. To let them reach the app, add two secrets in the Supabase SQL editor (the second is the same value as `JOBS_SECRET`):
   ```sql
   select vault.create_secret('https://app.foundrymedia.co', 'foundry_app_url');
   select vault.create_secret('<your JOBS_SECRET>', 'foundry_jobs_secret');
   ```
   Without them, reminders still appear in the app but no notification emails go out, and status moves on ClickUp tasks don't reach ClickUp. Vercel's own cron isn't needed (on the Hobby plan it only runs once a day).

---

## Build phases

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Auth, roles, layout, dashboard shell, theming | ✅ Built |
| 2 | Client intake form, client pipeline, client onboarding checklist | ✅ Built |
| 3 | Editor application form, applicant pipeline, editor onboarding, roster | ✅ Built |
| 4 | Projects and tasks (Kanban, List, Calendar, By Editor) | ✅ Built |
| 4.5 | Workspaces: sign-up, create or join, switcher; hiring by invitation code; onboarding with limited access, test edit and review, interview, approval | ✅ Built |
| 5 | Attendance: start/stop, breaks, task switching, end-of-shift reports, live board, daily log, timesheets, hours, CSV export | ✅ Built |
| 6 | Messages (announcements, private team and client conversations), client portal, SOP editor, reminders and email notifications (Brevo), polish | ✅ Built |

Meetings (agenda, link, RSVPs) and the ideas board aren't built yet. Their tables are already in the schema.
