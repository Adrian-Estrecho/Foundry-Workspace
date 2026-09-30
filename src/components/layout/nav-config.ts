import {
  BookOpenIcon,
  Building2Icon,
  BriefcaseBusinessIcon,
  Clock3Icon,
  FolderKanbanIcon,
  HouseIcon,
  ListChecksIcon,
  MessagesSquareIcon,
  RocketIcon,
  SquareCheckBigIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: AppRole[];
  /** Editors who hold one of these abilities see it too. */
  permissions?: Permission[];
  /** Shown to editors who are still onboarding (their only pages). */
  duringOnboarding?: boolean;
  /** Sidebar group heading; items without one sit at the top. */
  section?: "Network" | "Work" | "Company";
};

/** Who is looking: their role, abilities, and whether they're still onboarding. */
export type NavAccess = { role: AppRole; permissions: Permission[]; onboarding: boolean };

/** Any of these opens the Workspace page (each shows its own sections). */
export const WORKSPACE_PERMISSIONS: Permission[] = [
  "workspace.brand",
  "workspace.forms",
  "workspace.contract",
  "workspace.links",
  "editors.manage",
];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: HouseIcon, roles: ["admin", "editor"], duringOnboarding: true },
  { href: "/onboarding", label: "Onboarding", icon: RocketIcon, roles: ["editor"], duringOnboarding: true },
  { href: "/clients", label: "Clients", icon: BriefcaseBusinessIcon, roles: ["admin"], permissions: ["clients.manage"], section: "Network" },
  { href: "/editors", label: "Editors", icon: UsersIcon, roles: ["admin"], permissions: ["editors.manage"], section: "Network" },
  { href: "/projects", label: "Projects", icon: FolderKanbanIcon, roles: ["admin", "editor"], section: "Work" },
  { href: "/tasks", label: "Tasks", icon: ListChecksIcon, roles: ["admin"], permissions: ["tasks.manage"], section: "Work" },
  { href: "/my-tasks", label: "My Tasks", icon: SquareCheckBigIcon, roles: ["editor"], section: "Work" },
  { href: "/attendance", label: "Attendance", icon: Clock3Icon, roles: ["admin", "editor"], section: "Work" },
  { href: "/messages", label: "Messages", icon: MessagesSquareIcon, roles: ["admin", "editor"], section: "Company" },
  { href: "/sops", label: "SOPs", icon: BookOpenIcon, roles: ["admin", "editor"], section: "Company", duringOnboarding: true },
  { href: "/people", label: "People", icon: UserCogIcon, roles: ["admin"], section: "Company" },
  {
    href: "/workspace",
    label: "Workspace",
    icon: Building2Icon,
    roles: ["admin"],
    permissions: WORKSPACE_PERMISSIONS,
    section: "Company",
  },
];

/**
 * Nav for someone. Editors still onboarding only see their dashboard,
 * Onboarding and SOPs; once approved, Onboarding leaves the menu.
 */
export function navFor({ role, permissions, onboarding }: NavAccess) {
  return NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(role) && !item.permissions?.some((p) => permissions.includes(p))) return false;
    if (onboarding) return Boolean(item.duringOnboarding);
    return item.href !== "/onboarding";
  });
}

/** Groups items under their section headings, keeping NAV_ITEMS order. */
export function navSections(items: NavItem[]) {
  const sections: { label?: NavItem["section"]; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = sections.at(-1);
    if (last && last.label === item.section) last.items.push(item);
    else sections.push({ label: item.section, items: [item] });
  }
  return sections;
}

export const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);
