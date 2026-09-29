"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BriefcaseBusinessIcon,
  ClapperboardIcon,
  ClipboardListIcon,
  Clock3Icon,
  CopyIcon,
  ExternalLinkIcon,
  FileSignatureIcon,
  FilmIcon,
  FolderOpenIcon,
  Link2Icon,
  Loader2Icon,
  PackageIcon,
  PaletteIcon,
  PencilRulerIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";
import { AccentPicker } from "@/components/theme/accent-picker";
import { FormRow } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FORM_NAMES, type FormKind } from "@/features/forms/fields";
import type { Workspace } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { updateHiring, updateWorkspace } from "./actions";
import { BrandPreview } from "./brand-preview";
import { LogoUpload } from "./logo-upload";

/** A public form at a glance, for the Forms section. */
export type FormSummary = { questions: number; own: number; updatedAt: string | null };

export type TestTemplate = {
  test_title: string | null;
  test_brief: string | null;
  test_asset_url: string | null;
  test_due_days: number;
};

const WORKSPACE_FIELDS = [
  "name",
  "default_accent",
  "slug",
  "accepting_applications",
  "contract_template_url",
  "frameio_invite_url",
  "asset_pack_url",
  "missed_clock_in_grace_minutes",
] as const;
const TEST_FIELDS = ["test_title", "test_brief", "test_asset_url", "test_due_days"] as const;
const FIELDS = [...WORKSPACE_FIELDS, ...TEST_FIELDS];

type Field = (typeof FIELDS)[number];
type Values = Record<Exclude<Field, "accepting_applications">, string> & { accepting_applications: boolean };
type TextField = Exclude<Field, "accepting_applications" | "default_accent">;

const SECTIONS = [
  { id: "brand", label: "Brand", icon: PaletteIcon, fields: ["name", "default_accent"] },
  { id: "links", label: "Public links", icon: Link2Icon, fields: ["slug", "accepting_applications"] },
  { id: "forms", label: "Forms", icon: ClipboardListIcon, fields: [] },
  { id: "onboarding", label: "Onboarding", icon: PackageIcon, fields: ["contract_template_url", "frameio_invite_url", "asset_pack_url"] },
  { id: "attendance", label: "Attendance", icon: Clock3Icon, fields: ["missed_clock_in_grace_minutes"] },
  { id: "hiring", label: "Test edit", icon: ClapperboardIcon, fields: TEST_FIELDS },
] as const satisfies { id: string; label: string; icon: LucideIcon; fields: readonly Field[] }[];
const SECTION_IDS = SECTIONS.map((s) => s.id);

const RESOURCES = [
  {
    field: "contract_template_url",
    label: "Contract and NDA",
    icon: FileSignatureIcon,
    hint: "New editors download, sign and upload these.",
    placeholder: "https://drive.google.com/…",
  },
  {
    field: "frameio_invite_url",
    label: "Frame.io invite",
    icon: FilmIcon,
    hint: "Lets new editors join your Frame.io workspace.",
    placeholder: "https://app.frame.io/…",
  },
  {
    field: "asset_pack_url",
    label: "Asset pack",
    icon: FolderOpenIcon,
    hint: "Brand files, fonts and presets they'll work with.",
    placeholder: "https://drive.google.com/…",
  },
] as const;

const isLink = (value: string) => /^https?:\/\/\S+$/.test(value.trim());

/** Minutes after midnight as 9:00 or 21:30. */
const clock = (minutes: number) => `${Math.floor(minutes / 60) % 24}:${String(minutes % 60).padStart(2, "0")}`;

function initialValues(workspace: Workspace, template: TestTemplate | null): Values {
  return {
    name: workspace.name,
    default_accent: workspace.default_accent,
    slug: workspace.slug,
    accepting_applications: workspace.accepting_applications,
    contract_template_url: workspace.contract_template_url ?? "",
    frameio_invite_url: workspace.frameio_invite_url ?? "",
    asset_pack_url: workspace.asset_pack_url ?? "",
    missed_clock_in_grace_minutes: String(workspace.missed_clock_in_grace_minutes),
    test_title: template?.test_title ?? "",
    test_brief: template?.test_brief ?? "",
    test_asset_url: template?.test_asset_url ?? "",
    test_due_days: String(template?.test_due_days ?? 3),
  };
}

/**
 * Everything owners and admins set for the workspace, in sections with a
 * jump list. Edits collect until saved from the bar that appears (or
 * Ctrl/⌘+S); the logo is the exception and saves as soon as it's picked.
 */
export function WorkspaceSettings({
  workspace,
  template,
  logoUrl,
  siteUrl,
  formSummaries,
}: {
  workspace: Workspace;
  template: TestTemplate | null;
  logoUrl: string | null;
  siteUrl: string;
  formSummaries: Record<FormKind, FormSummary>;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [saved, setSaved] = React.useState(() => initialValues(workspace, template));
  const [values, setValues] = React.useState(saved);
  const [logo, setLogo] = React.useState(logoUrl);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const active = useActiveSection(SECTION_IDS);

  const changed = (fields: readonly Field[]) => fields.some((field) => values[field] !== saved[field]);
  const dirty = changed(FIELDS);

  const set = <K extends keyof Values>(field: K, value: Values[K]) => setValues((v) => ({ ...v, [field]: value }));
  const text = (field: TextField) => ({
    id: `ws-${field}`,
    name: field,
    value: values[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(field, event.target.value),
    "aria-invalid": fieldErrors[field] ? true : undefined,
  });

  const save = () => {
    if (!dirty || pending) return;
    const submitted = values;
    const formData = new FormData();
    for (const [field, value] of Object.entries(submitted)) {
      if (typeof value === "string") formData.set(field, value);
      else if (value) formData.set(field, "on");
    }
    const jobs = [
      ...(changed(WORKSPACE_FIELDS) ? [{ fields: WORKSPACE_FIELDS, run: () => updateWorkspace(formData) }] : []),
      ...(changed(TEST_FIELDS) ? [{ fields: TEST_FIELDS, run: () => updateHiring(formData) }] : []),
    ];

    startTransition(async () => {
      const results = await Promise.all(jobs.map((job) => job.run()));
      const errors: Record<string, string> = {};
      let failure: string | null = null;
      const next = { ...saved };
      results.forEach((result, index) => {
        if (result.ok) for (const field of jobs[index].fields) Object.assign(next, { [field]: submitted[field] });
        else {
          Object.assign(errors, result.fieldErrors);
          failure ??= result.error;
        }
      });
      setSaved(next);
      setFieldErrors(errors);
      router.refresh();

      if (!failure) return void toast.success("Workspace settings saved");
      toast.error(failure);
      const first = FIELDS.find((field) => errors[field]);
      if (first) formRef.current?.querySelector<HTMLElement>(`#ws-${first}`)?.focus();
    });
  };

  const discard = () => {
    setValues(saved);
    setFieldErrors({});
  };

  // Ctrl/⌘+S saves; leaving with unsaved edits asks first.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const host = siteUrl.replace(/^https?:\/\//, "");
  const linksLive = values.slug === saved.slug;
  const resourcesAdded = RESOURCES.filter((r) => isLink(values[r.field])).length;
  const graceMinutes = Math.min(Math.max(Math.round(Number(values.missed_clock_in_grace_minutes)) || 0, 0), 720);
  const [brand, links, formsSection, onboarding, attendance, hiring] = SECTIONS;

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      noValidate
      className="grid grid-cols-1 gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]"
    >
      <nav aria-label="Workspace settings" className="sticky top-20 hidden gap-0.5 self-start lg:grid">
        {SECTIONS.map((section) => {
          const current = active === section.id;
          const hasError = section.fields.some((field) => fieldErrors[field]);
          const unsaved = changed(section.fields);
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                history.replaceState(null, "", `#${section.id}`);
              }}
              aria-current={current ? "location" : undefined}
              className={cn(
                "relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                current
                  ? "bg-accent text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <section.icon className={cn("size-4 shrink-0", current && "text-primary")} />
              <span className="truncate">{section.label}</span>
              {(hasError || unsaved) && (
                <>
                  <span
                    aria-hidden="true"
                    className={cn("ml-auto size-1.5 shrink-0 rounded-full", hasError ? "bg-danger" : "bg-warning")}
                  />
                  <span className="sr-only">{hasError ? "(has errors)" : "(unsaved changes)"}</span>
                </>
              )}
            </a>
          );
        })}
      </nav>

      <div className="grid min-w-0 grid-cols-1 content-start gap-5 2xl:grid-cols-2">
        <Section section={brand} description="How your workspace looks to your team, applicants and clients." className="2xl:col-span-2">
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid content-start gap-6">
              <LogoUpload workspaceId={workspace.id} logoUrl={logo} onChange={setLogo} />
              <FormRow label="Workspace name" error={fieldErrors.name}>
                <Input {...text("name")} maxLength={60} autoComplete="organization" />
              </FormRow>
              <div className="grid gap-3">
                <div>
                  <p className="text-sm font-medium">Accent colour</p>
                  <p className="text-xs text-muted-foreground">
                    Used on your public forms and client portal, and for anyone here who hasn&apos;t picked their own.
                  </p>
                </div>
                <AccentPicker value={values.default_accent} onChange={(hex) => set("default_accent", hex.toUpperCase())} />
                {fieldErrors.default_accent && (
                  <p className="text-xs text-danger" role="alert">
                    {fieldErrors.default_accent}
                  </p>
                )}
              </div>
            </div>
            <BrandPreview
              name={values.name}
              accent={values.default_accent}
              logoUrl={logo}
              address={`${host}/apply/${values.slug}`}
              accepting={values.accepting_applications}
            />
          </div>
        </Section>

        <Section
          section={links}
          description="Share these so editors can apply and clients can send you work. No sign-in needed."
          badge={
            <Badge tone={values.accepting_applications ? "success" : "muted"}>
              {values.accepting_applications ? "Hiring" : "Not hiring"}
            </Badge>
          }
        >
          <div className="grid gap-5">
            <FormRow
              label="Link name"
              error={fieldErrors.slug}
              hint="Lowercase letters, numbers and dashes. Changing it breaks links you've already shared."
            >
              <Input
                {...text("slug")}
                onChange={(event) => set("slug", event.target.value.toLowerCase())}
                maxLength={40}
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
              />
            </FormRow>
            <div className="divide-y rounded-lg bg-surface ring-1 ring-border">
              <PublicLink icon={UserPlusIcon} label="Application form" url={`${siteUrl}/apply/${values.slug}`} live={linksLive} />
              <PublicLink icon={BriefcaseBusinessIcon} label="Project request form" url={`${siteUrl}/intake/${values.slug}`} live={linksLive} />
            </div>
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg bg-surface p-4 ring-1 ring-border">
              <span>
                <span className="block text-sm font-medium">Accepting applications</span>
                <span className="block text-xs text-muted-foreground">
                  When off, your application page says you aren&apos;t hiring right now.
                </span>
              </span>
              <Switch
                checked={values.accepting_applications}
                onCheckedChange={(checked) => set("accepting_applications", checked)}
              />
            </label>
          </div>
        </Section>

        <Section
          section={formsSection}
          description="Change the questions on your public forms: add your own, drag them into order, take some off."
        >
          <div className="grid gap-3">
            <FormCard kind="apply" icon={UserPlusIcon} summary={formSummaries.apply} url={`${siteUrl}/apply/${saved.slug}`} />
            <FormCard kind="intake" icon={BriefcaseBusinessIcon} summary={formSummaries.intake} url={`${siteUrl}/intake/${saved.slug}`} />
          </div>
        </Section>

        <Section
          section={onboarding}
          description="Links every new editor gets while they onboard."
          className="2xl:col-span-2"
          badge={
            <Badge tone={resourcesAdded === RESOURCES.length ? "success" : "muted"}>
              {resourcesAdded} of {RESOURCES.length} added
            </Badge>
          }
        >
          <div className="grid gap-3 2xl:grid-cols-3">
            {RESOURCES.map((resource) => {
              const value = values[resource.field];
              const added = isLink(value);
              const error = fieldErrors[resource.field];
              return (
                <div key={resource.field} className="flex gap-4 rounded-lg bg-surface p-4 ring-1 ring-border">
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-lg ring-1 transition-colors",
                      added ? "bg-success/12 text-success ring-success/25" : "bg-card text-muted-foreground ring-border",
                    )}
                  >
                    <resource.icon className="size-4.5" />
                  </span>
                  <div className="grid min-w-0 flex-1 gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor={`ws-${resource.field}`} className="text-sm font-medium">
                        {resource.label}
                      </label>
                      {added ? (
                        <a
                          href={value.trim()}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Open <ExternalLinkIcon className="size-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not added</span>
                      )}
                    </div>
                    <Input type="url" {...text(resource.field)} placeholder={resource.placeholder} />
                    {error ? (
                      <span className="text-xs text-danger" role="alert">
                        {error}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{resource.hint}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section section={attendance} description="When to flag an editor who hasn't started their shift." className="2xl:col-span-2">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-start">
            <FormRow label="Missed start alert" error={fieldErrors.missed_clock_in_grace_minutes} hint="0 to 720 minutes after the shift starts.">
              <span className="relative block">
                <Input type="number" min={0} max={720} {...text("missed_clock_in_grace_minutes")} className="pr-18" />
                <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted-foreground">
                  minutes
                </span>
              </span>
            </FormRow>
            <AlertTimeline minutes={graceMinutes} />
          </div>
        </Section>

        <Section
          section={hiring}
          className="2xl:col-span-2"
          description="Given to every editor who joins with an invitation, due a few days later. Leave the title empty to assign one by hand from their profile."
          badge={
            <Badge tone={values.test_title.trim() ? "success" : "muted"}>
              {values.test_title.trim() ? "Sent automatically" : "Assigned by hand"}
            </Badge>
          }
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormRow label="Title" error={fieldErrors.test_title} className="sm:col-span-2">
              <Input {...text("test_title")} placeholder="Test edit · 30s product teaser" maxLength={120} />
            </FormRow>
            <FormRow
              label="Brief"
              hint="What to make, format and length, what you're looking for."
              error={fieldErrors.test_brief}
              className="sm:col-span-2"
            >
              <Textarea {...text("test_brief")} rows={5} maxLength={4000} className="rounded-xl" />
            </FormRow>
            <FormRow label="Footage and assets (link)" error={fieldErrors.test_asset_url}>
              <Input type="url" {...text("test_asset_url")} placeholder="https://drive.google.com/…" />
            </FormRow>
            <FormRow label="Due after" error={fieldErrors.test_due_days}>
              <span className="relative block">
                <Input type="number" min={1} max={30} {...text("test_due_days")} className="pr-14" />
                <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted-foreground">
                  days
                </span>
              </span>
            </FormRow>
          </div>
        </Section>

        <div
          inert={!dirty}
          className={cn(
            "sticky bottom-4 z-20 transition-[opacity,translate] duration-200 2xl:col-span-2",
            dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
          )}
        >
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg shadow-black/10">
            <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
            <p className="text-sm font-medium">Unsaved changes</p>
            <kbd className="hidden rounded-md border bg-background px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground sm:inline">
              Ctrl + S
            </kbd>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="ghost" onClick={discard} disabled={pending}>
                Discard
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2Icon className="animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function Section({
  section,
  description,
  badge,
  className,
  children,
}: {
  section: (typeof SECTIONS)[number];
  description: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className={cn("scroll-mt-20 rounded-xl border bg-card", className)}>
      <header className="flex flex-wrap items-start gap-x-3.5 gap-y-2 border-b px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
          <section.icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <h2 id={`${section.id}-title`} className="font-heading text-base font-medium">
            {section.label}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        {badge}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Badge({ tone, children }: { tone: "success" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "success" ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone === "success" ? "bg-success" : "bg-muted-foreground/60")} />
      {children}
    </span>
  );
}

function FormCard({
  kind,
  icon: Icon,
  summary,
  url,
}: {
  kind: FormKind;
  icon: LucideIcon;
  summary: FormSummary;
  url: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg bg-surface p-4 ring-1 ring-border">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-medium">{FORM_NAMES[kind]}</p>
        <p className="text-xs text-muted-foreground">
          {summary.questions} questions · {summary.own > 0 ? `${summary.own} of your own` : "standard questions"}
          {summary.updatedAt && ` · edited ${formatDay(summary.updatedAt.slice(0, 10), { month: "short", day: "numeric" })}`}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button asChild variant="ghost" size="icon-sm">
          <a href={url} target="_blank" rel="noreferrer" aria-label={`Open the ${FORM_NAMES[kind].toLowerCase()}`}>
            <ExternalLinkIcon />
          </a>
        </Button>
        <Button asChild size="sm">
          <Link href={`/workspace/forms/${kind}`}>
            <PencilRulerIcon /> Edit form
          </Link>
        </Button>
      </div>
    </div>
  );
}

function PublicLink({ icon: Icon, label, url, live }: { icon: LucideIcon; label: string; url: string; live: boolean }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} link copied`);
    } catch {
      toast.error("Couldn't copy. Your browser blocked clipboard access.");
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{url.replace(/^https?:\/\//, "")}</p>
      </div>
      {live ? (
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon-sm" onClick={copy} aria-label={`Copy ${label.toLowerCase()} link`}>
            <CopyIcon />
          </Button>
          <Button asChild variant="ghost" size="icon-sm">
            <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${label.toLowerCase()}`}>
              <ExternalLinkIcon />
            </a>
          </Button>
        </div>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">Save to update</span>
      )}
    </div>
  );
}

/**
 * The grace period on a strip like an editing timeline: the shift starts at
 * the left edge, and the playhead marks when the alert goes out.
 */
function AlertTimeline({ minutes }: { minutes: number }) {
  const START = 9 * 60;
  const hours = Math.max(2, Math.ceil((minutes + 30) / 60));
  const step = Math.ceil(hours / 5);
  const at = (minutes / (hours * 60)) * 100;
  const align = at < 12 ? "translate-x-0" : at > 88 ? "-translate-x-full" : "-translate-x-1/2";

  return (
    <div className="rounded-lg bg-surface px-4 pt-3 pb-3 ring-1 ring-border">
      <p className="text-xs text-muted-foreground">
        For a shift starting at 9:00, the alert goes out at{" "}
        <span className="font-medium text-foreground tabular">{clock(START + minutes)}</span> if they haven&apos;t started.
      </p>
      <div className="relative mt-10 h-2 rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary/30" style={{ width: `${at}%` }} />
        <div className="absolute -inset-y-1.5 w-0.5 -translate-x-1/2 rounded-full bg-primary" style={{ left: `${at}%` }} />
        <span
          className={cn(
            "absolute -top-8 rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-primary-foreground tabular",
            align,
          )}
          style={{ left: `${at}%` }}
        >
          Alert {clock(START + minutes)}
        </span>
      </div>
      <div className="relative mt-2 h-4" aria-hidden="true">
        {Array.from({ length: hours + 1 }, (_, hour) => hour)
          .filter((hour) => hour % step === 0 || hour === hours)
          .map((hour) => (
            <span
              key={hour}
              className={cn(
                "absolute text-[11px] text-muted-foreground tabular",
                hour === 0 ? "" : hour === hours ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${(hour / hours) * 100}%` }}
            >
              {clock(START + hour * 60)}
            </span>
          ))}
      </div>
    </div>
  );
}

/**
 * Which section is at the top of the screen, for the jump list: the last one
 * whose top has passed just under the top bar. At the very bottom of the
 * page it's the last section, even if that one is too short to get there.
 */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = React.useState(ids[0]);
  React.useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = ids[0];
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= 140) current = id;
      }
      setActive(atBottom ? ids[ids.length - 1] : current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids]);
  return active;
}
