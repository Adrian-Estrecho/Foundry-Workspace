# Foundry

The company management system for **Foundry Media**: client onboarding, editor onboarding, projects and tasks, and live editor attendance, all in one place. Hosted at `app.foundrymedia.co`.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (Postgres, Auth, Storage, Realtime, RLS) · Resend · Vercel

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
npm run dev           # http://localhost:3000
```

### Seed logins

The password for all of these is `foundry123`.

| Email | Role | Notes |
| --- | --- | --- |
| `admin@foundrymedia.co` | Admin | Alex Morgan |
| `lucas@foundrymedia.co` | Editor | Working right now |
| `maya@foundrymedia.co` | Editor | On a break |
| `diego@foundrymedia.co` | Editor | Working right now |
| `priya@foundrymedia.co` | Editor | New, onboarding 3/6, trial task in progress |

The seed dates are relative to the moment you run it, so the dashboard always shows about 6 months of history plus "today". Re-run `npm run db:reset` to refresh them.

### Useful local URLs

- **Supabase Studio** (browse data): http://127.0.0.1:54323
- **Mailpit** (every email sent locally: password resets, lead and applicant alerts, invites, test edits): http://127.0.0.1:54324
- **Public client intake form** (no login): http://localhost:3000/intake
- **Public editor application form** (no login): http://localhost:3000/apply

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
  seed.sql             demo company: 1 admin, 4 editors, clients, projects, tasks, time logs
  templates/           branded auth emails (invite, password reset)
src/
  app/
    (auth)/            login, forgot password, welcome (set password after invite/reset)
    (public)/          intake + application forms, test-edit submission (no login)
    (app)/             signed-in app: dashboard, clients, editors, projects, tasks, ...
    auth/confirm/      landing route for email links
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

### Roles and security

- **Admin:** full access to everything.
- **Editor:** their own tasks, the projects they're on (including who else is on the team, but not the client's contact details), their attendance and onboarding, plus the shared announcements and SOPs.
- **Clients:** never log in. They use the public intake form.

Row Level Security enforces this on every table (see `supabase/migrations/20260927000003_rls.sql`). A few rules sit in database triggers so no client can get around them:
- Editors can move their tasks only as far as **For Review**. Only an admin marks a task Done, requests Revisions or reopens a Done task.
- Editors can't change their own role.
- Attendance rows are read-only to editors and are written only by database functions.

Sign-up is disabled, so accounts are created by admins only.

### Client onboarding

1. A lead submits the public form at `/intake`. Spam is filtered by a honeypot field, a signed timing token and a per-email rate limit.
2. The lead lands at the top of **New Lead**. Admins get an in-app notification and an email.
3. Move clients through the pipeline by dragging cards or using a card's **Move to** menu, which is easier on a phone.
4. At **Contract Signed** the 6-step onboarding checklist appears. Four steps tick themselves: contract uploaded, deposit paid, Drive link added, editor assigned.
5. At **Kickoff** Foundry asks you to create the client's first project.

Contract PDFs go to a private storage bucket and open through short-lived signed links.

### Editor hiring and onboarding

1. Applicants apply at `/apply` (same spam protection as the intake form, plus one application per email every 30 days). They land at the top of **Applied**, and admins get a notification and an email.
2. Moving someone to **Test Edit Sent** offers to email the test brief. The email carries a personal, signed link where they send back their edit. That moves them to **Test Submitted** and alerts admins.
3. Rate applicants (1–5) and keep private notes on their page.
4. **Approve** creates their Foundry account, filled in from the application, and emails a Welcome to Foundry invite. **Reject** can send a short, polite note. Both ask for confirmation, including when you drop a card on those columns.
5. The invite link opens `/welcome` to choose a password, then **Onboarding**, a 6-step checklist:
   - contract and NDA upload, payment details, required SOPs and the trial task tick themselves;
   - editors tick Frame.io and the asset pack themselves;
   - admins can tick or untick any step from the editor's profile.
6. Admins assign the trial task from the editor's profile and approve it or request changes there. When the last step is done, admins are notified and Onboarding leaves the editor's menu.

The contract and NDA templates, Frame.io invite and asset pack links that editors see during onboarding are set in **Settings → Company**.

Admins can also invite an editor directly (**Editors → Invite editor**), resend an invite, edit skills, rate and schedule, and mark editors inactive. Inactive editors keep their login but are hidden from assignment and the live board. Signed contracts and NDAs sit in a private bucket that only the editor and admins can open.

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

Notifications (in-app): editors hear about new assignments and requested revisions, admins hear when work is ready for review, and anyone @mentioned is notified. Status changes, reassignments and new tasks appear in the activity feed. Due-tomorrow and overdue reminders, and email for these notifications, arrive with Phase 6.

### Working status

- **Online / Offline** means Foundry is open, tracked with Supabase Realtime Presence.
- **Working / On break** is a switch the editor sets. The owner sees both live on the dashboard.

### Adjustable colour

Every user can pick an accent in **Settings → Appearance**: one of six presets or any hex colour. There is also an option to tint the dark or light background with that hue. Admins set the company default, which is used on the login and public pages.

One hex value is converted to OKLCH (`src/lib/theme.ts`), clamped for contrast in each mode, and rendered on the server, so the first paint has no flash. Status colours (working, break, online, offline, overdue) never change with the accent.

---

## Deployment (Vercel + hosted Supabase)

1. **Create a Supabase project**, then link it and push the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   Don't run `seed.sql` in production. Create the owner account in the dashboard under **Authentication → Users → Add user**, then make it an admin:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@foundrymedia.co';
   ```
2. **Configure Supabase Auth** (Authentication settings):
   - Site URL: `https://app.foundrymedia.co`
   - Redirect URLs: `https://app.foundrymedia.co/**`
   - Disable "Allow new users to sign up".
   - Email templates: paste `supabase/templates/invite.html` and `recovery.html`.
   - Email OTP expiry: consider raising it (for example to 24 hours) so invite links sent by Foundry don't expire before editors open them. Admins can always resend an invite from the editor's profile.
   - SMTP: use Resend's SMTP settings, so auth emails come from your domain.
3. **Deploy to Vercel:** import the repo, then set the variables from `.env.example`, with `NEXT_PUBLIC_SITE_URL=https://app.foundrymedia.co`.
4. **Domain:** add `app.foundrymedia.co` to the Vercel project, and verify the sending domain in Resend.

---

## Build phases

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Auth, roles, layout, dashboard shell, theming | ✅ Built |
| 2 | Client intake form, client pipeline, client onboarding checklist | ✅ Built |
| 3 | Editor application form, applicant pipeline, editor onboarding, roster | ✅ Built |
| 4 | Projects and tasks (Kanban, List, Calendar, By Editor) | ✅ Built |
| 5 | Attendance, live status board, timesheets, CSV export | Next |
| 6 | Announcements, meetings, SOPs, notifications, polish | |

Pages for later phases are already in the navigation. For now each shows what it will do.
