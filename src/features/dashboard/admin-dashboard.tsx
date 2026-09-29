import {
  AlarmClockIcon,
  BriefcaseBusinessIcon,
  CalendarClockIcon,
  FolderKanbanIcon,
  SparklesIcon,
  UserPlusIcon,
} from "lucide-react";
import { KpiTile } from "@/components/shared/kpi-tile";
import { PageHeader } from "@/components/shared/panel";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import type { CurrentUser } from "@/lib/auth";
import { greeting } from "@/lib/dates";
import { firstName } from "@/lib/utils";
import { ActivityFeed } from "./activity-feed";
import { CompletedBars } from "./completed-bars";
import { Deadlines } from "./deadlines";
import { GettingStarted, type SetupProgress } from "./getting-started";
import { GrowTeamCard } from "./grow-team-card";
import { HoursChart } from "./hours-chart";
import { OnlineKpi } from "./online-kpi";
import type { getAdminDashboard } from "./queries";
import { WhosWorking } from "./whos-working";

type Data = Awaited<ReturnType<typeof getAdminDashboard>>;

/** "What's happening in my company right now?" */
export function AdminDashboard({ user, data, setup }: { user: CurrentUser; data: Data; setup: SetupProgress }) {
  const { kpis } = data;

  return (
    <>
      {/* Live: re-render when editors change status, tasks move or activity lands. */}
      <RealtimeRefresh channel="admin-dashboard" tables="editors,tasks,activity_log" />

      <PageHeader
        title={`${greeting(data.timeZone)}, ${firstName(user.full_name)}`}
        description={`Here's what's happening at ${user.workspace.name} right now.`}
      />

      <GettingStarted setup={setup} />

      {/* Scrolls sideways on phones; wraps on desktop. */}
      <div className="-mx-4 mb-5 overflow-x-auto px-4 pb-1 scrollbar-none sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0">
        <div className="grid min-w-max grid-flow-col auto-cols-[minmax(10rem,1fr)] gap-3 lg:min-w-0 lg:grid-flow-row lg:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
          <KpiTile label="Active clients" value={kpis.activeClients} icon={BriefcaseBusinessIcon} href="/clients" />
          <KpiTile label="Active projects" value={kpis.activeProjects} icon={FolderKanbanIcon} href="/projects" />
          <KpiTile label="Due today" value={kpis.dueToday} icon={CalendarClockIcon} href="/tasks?view=list&due=today" />
          <KpiTile
            label="Overdue"
            value={kpis.overdue}
            icon={AlarmClockIcon}
            tone={kpis.overdue > 0 ? "danger" : "default"}
            hint={kpis.overdue > 0 ? "Needs attention" : "All on track"}
            href="/tasks?view=list&due=overdue"
          />
          <OnlineKpi editorIds={data.team.map((m) => m.id)} recentlySeen={data.team.filter((m) => m.recentlySeen).length} />
          <KpiTile label="New leads" value={kpis.newLeads} icon={SparklesIcon} href="/clients" />
          <KpiTile label="New applicants" value={kpis.newApplicants} icon={UserPlusIcon} href="/editors/applicants" />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="grid gap-5 xl:col-span-8">
          <HoursChart
            title="Team hours"
            data={data.hours}
            today={data.today}
            weeklyCapacityHours={data.weeklyCapacityHours}
          />
          <div className="grid gap-5 md:grid-cols-5">
            <GrowTeamCard
              className="md:col-span-2"
              slug={user.workspace.slug}
              applicants={data.applicants}
              newApplicants={kpis.newApplicants}
            />
            <CompletedBars className="md:col-span-3" data={data.completed} />
          </div>
        </div>
        {/* On phones, live status comes first. */}
        <div className="order-first xl:order-none xl:col-span-4">
          <WhosWorking team={data.team} renderedAt={data.renderedAt} />
        </div>

        <Deadlines className="xl:col-span-8" tasks={data.dueTasks} today={data.today} />
        <ActivityFeed className="xl:col-span-4" items={data.activity} renderedAt={data.renderedAt} />
      </div>
    </>
  );
}
