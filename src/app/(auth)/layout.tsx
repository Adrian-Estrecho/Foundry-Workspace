import { ActivityIcon, KanbanSquareIcon, ListChecksIcon, TimerIcon } from "lucide-react";
import { FoundryLogo } from "@/components/brand/logo";
import { AccentStyle } from "@/components/theme/accent-style";
import { getBranding } from "@/lib/branding";

const FEATURES = [
  { icon: ActivityIcon, title: "Who's working, live", text: "See every editor's status and current task as it changes." },
  { icon: KanbanSquareIcon, title: "Client & editor pipelines", text: "From first enquiry and first application to kickoff." },
  { icon: ListChecksIcon, title: "Every task in one place", text: "Kanban, list, calendar and workload views." },
  { icon: TimerIcon, title: "Timesheets that fill themselves", text: "Hours logged per task, project and editor." },
];

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const { defaultAccent } = await getBranding();

  return (
    <>
      <AccentStyle accent={defaultAccent} />
      <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Brand panel (desktop) */}
        <section className="m-4 hidden rounded-2xl border bg-card p-10 lg:flex lg:flex-col">
          <FoundryLogo />
          <div className="mt-auto max-w-md">
            <h1 className="font-heading text-4xl leading-tight font-semibold tracking-tight text-balance">
              Run Foundry Media from one place.
            </h1>
            <p className="mt-3 text-muted-foreground">
              Clients, editors, projects and attendance, all live.
            </p>
            <ul className="mt-10 grid gap-5">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <span className="block font-medium">{title}</span>
                    <span className="block text-sm text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-12 text-xs text-muted-foreground">app.foundrymedia.co</p>
        </section>

        {/* Form column */}
        <section className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-sm">
            <FoundryLogo className="mb-10 lg:hidden" />
            {children}
          </div>
        </section>
      </main>
    </>
  );
}
