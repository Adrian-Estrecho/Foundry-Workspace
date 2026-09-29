"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRightIcon,
  BriefcaseBusinessIcon,
  FolderKanbanIcon,
  ListChecksIcon,
  LogOutIcon,
  MoonIcon,
  PaletteIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { useTheme } from "@/components/theme/theme-provider";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { switchWorkspace } from "@/features/workspaces/actions";
import { createClient } from "@/lib/supabase/client";
import type { SwitcherProps } from "./app-sidebar";
import { navFor, type NavAccess } from "./nav-config";

const noopSubscribe = () => () => {};

/**
 * Global command palette (Ctrl+K / ⌘K). Jump anywhere, switch workspace or
 * theme, sign out. Full members can jump to their open tasks and projects;
 * admins also to any client, editor or applicant.
 */
export function CommandMenu({ access, switcher }: { access: NavAccess; switcher: SwitcherProps }) {
  const { role, onboarding } = access;
  const [open, setOpen] = React.useState(false);
  const isMac = React.useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const items = navFor(access);
  const otherWorkspaces = switcher.workspaces.filter((w) => w.id !== switcher.current.id);
  const [clients, setClients] = React.useState<{ id: string; name: string; contact: string }[]>([]);
  const [editors, setEditors] = React.useState<{ id: string; name: string }[]>([]);
  const [applicants, setApplicants] = React.useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = React.useState<{ id: string; name: string }[]>([]);
  const [tasks, setTasks] = React.useState<{ id: string; title: string; project: string | null; isTrial: boolean }[]>([]);

  // Projects and open tasks, for full members (RLS gives editors their own).
  React.useEffect(() => {
    if (!open || onboarding) return;
    let cancelled = false;
    const supabase = createClient();
    void Promise.all([
      supabase.from("projects").select("id, name").neq("status", "delivered").order("name"),
      supabase
        .from("tasks")
        .select("id, title, is_trial, project:projects(name)")
        .neq("status", "done")
        .order("due_date", { nullsFirst: false })
        .limit(200),
    ]).then(([projectRows, taskRows]) => {
      if (cancelled) return;
      setProjects(projectRows.data ?? []);
      setTasks((taskRows.data ?? []).map((t) => ({ id: t.id, title: t.title, project: t.project?.name ?? null, isTrial: t.is_trial })));
    });
    return () => {
      cancelled = true;
    };
  }, [open, onboarding]);

  // Load records each time the palette opens, so new leads and applicants are searchable.
  React.useEffect(() => {
    if (!open || role !== "admin") return;
    let cancelled = false;
    const supabase = createClient();
    void Promise.all([
      supabase.from("clients").select("id, company, contact_name").order("company"),
      supabase.from("editors").select("id, profile:profiles!editors_id_fkey(full_name)"),
      supabase.from("applicants").select("id, full_name").not("stage", "in", "(joined,rejected)").order("full_name"),
    ]).then(([clientRows, editorRows, applicantRows]) => {
      if (cancelled) return;
      setClients((clientRows.data ?? []).map((c) => ({ id: c.id, name: c.company?.trim() || c.contact_name, contact: c.contact_name })));
      setEditors(
        (editorRows.data ?? [])
          .map((e) => ({ id: e.id, name: e.profile?.full_name ?? "Editor" }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setApplicants((applicantRows.data ?? []).map((a) => ({ id: a.id, name: a.full_name })));
    });
    return () => {
      cancelled = true;
    };
  }, [open, role]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg bg-muted px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <SearchIcon className="size-4" />
        <span>Search</span>
        <kbd className="ml-auto hidden rounded-md border bg-background px-1.5 py-0.5 font-sans text-[11px] sm:inline">
          {isMac ? "⌘" : "Ctrl"} + K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} title={`Search ${switcher.current.name}`} description="Jump to a page or run a command">
        <Command>
          <CommandInput placeholder="Where do you want to go?" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Go to">
              {items.map(({ href, label, icon: Icon }) => (
                <CommandItem key={href} value={label} onSelect={() => run(() => router.push(href))}>
                  <Icon />
                  {label}
                </CommandItem>
              ))}
              <CommandItem value="Settings" onSelect={() => run(() => router.push("/settings"))}>
                <SettingsIcon />
                Settings
              </CommandItem>
            </CommandGroup>
            {tasks.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={role === "admin" ? "Open tasks" : "My open tasks"}>
                  {tasks.map((task) => (
                    <CommandItem
                      key={task.id}
                      value={`task ${task.title} ${task.project ?? ""} ${task.id}`}
                      onSelect={() => run(() => router.push(task.isTrial && role !== "admin" ? "/onboarding" : `/tasks/${task.id}`))}
                    >
                      <ListChecksIcon />
                      <span className="truncate">{task.title}</span>
                      {task.project && <span className="truncate text-muted-foreground">{task.project}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {projects.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Projects">
                  {projects.map((project) => (
                    <CommandItem
                      key={project.id}
                      value={`project ${project.name} ${project.id}`}
                      onSelect={() => run(() => router.push(`/projects/${project.id}`))}
                    >
                      <FolderKanbanIcon />
                      {project.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {clients.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Clients">
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={`client ${client.name} ${client.contact}`}
                      onSelect={() => run(() => router.push(`/clients/${client.id}`))}
                    >
                      <BriefcaseBusinessIcon />
                      {client.name}
                      {client.contact !== client.name && <span className="text-muted-foreground">{client.contact}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {editors.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Editors">
                  {editors.map((editor) => (
                    <CommandItem
                      key={editor.id}
                      value={`editor ${editor.name}`}
                      onSelect={() => run(() => router.push(`/editors/${editor.id}`))}
                    >
                      <UsersIcon />
                      {editor.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {applicants.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Applicants">
                  {applicants.map((applicant) => (
                    <CommandItem
                      key={applicant.id}
                      value={`applicant ${applicant.name}`}
                      onSelect={() => run(() => router.push(`/editors/applicants/${applicant.id}`))}
                    >
                      <UserPlusIcon />
                      {applicant.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {otherWorkspaces.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Switch workspace">
                  {otherWorkspaces.map((workspace) => (
                    <CommandItem
                      key={workspace.id}
                      value={`switch workspace ${workspace.name}`}
                      onSelect={() => run(() => void switchWorkspace(workspace.id))}
                    >
                      <ArrowLeftRightIcon />
                      {workspace.name}
                      <span className="text-muted-foreground">{workspace.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem
                value="Toggle theme dark light"
                onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
              >
                {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
                Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
              </CommandItem>
              <CommandItem value="Change accent colour appearance" onSelect={() => run(() => router.push("/settings#appearance"))}>
                <PaletteIcon />
                Change accent colour
              </CommandItem>
              <CommandItem value="Sign out log out" onSelect={() => run(() => void signOut())}>
                <LogOutIcon />
                Sign out
                <CommandShortcut />
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
