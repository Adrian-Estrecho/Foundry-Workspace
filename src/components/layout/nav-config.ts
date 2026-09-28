import {
  BookOpenIcon,
  BriefcaseBusinessIcon,
  Clock3Icon,
  FolderKanbanIcon,
  HouseIcon,
  ListChecksIcon,
  MegaphoneIcon,
  RocketIcon,
  SquareCheckBigIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { Enums } from "@/types/database";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Enums<"user_role">[];
  /** Sidebar group heading; items without one sit at the top. */
  section?: "People" | "Work" | "Company";
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: HouseIcon, roles: ["admin", "editor"] },
  { href: "/onboarding", label: "Onboarding", icon: RocketIcon, roles: ["editor"] },
  { href: "/clients", label: "Clients", icon: BriefcaseBusinessIcon, roles: ["admin"], section: "People" },
  { href: "/editors", label: "Editors", icon: UsersIcon, roles: ["admin"], section: "People" },
  { href: "/projects", label: "Projects", icon: FolderKanbanIcon, roles: ["admin", "editor"], section: "Work" },
  { href: "/tasks", label: "Tasks", icon: ListChecksIcon, roles: ["admin"], section: "Work" },
  { href: "/my-tasks", label: "My Tasks", icon: SquareCheckBigIcon, roles: ["editor"], section: "Work" },
  { href: "/attendance", label: "Attendance", icon: Clock3Icon, roles: ["admin", "editor"], section: "Work" },
  { href: "/announcements", label: "Announcements", icon: MegaphoneIcon, roles: ["admin", "editor"], section: "Company" },
  { href: "/sops", label: "SOPs", icon: BookOpenIcon, roles: ["admin", "editor"], section: "Company" },
];

/** Nav for a role. Editors only see Onboarding until they've finished it. */
export function navFor(role: Enums<"user_role">, { onboardingDone = true } = {}) {
  return NAV_ITEMS.filter(
    (item) => item.roles.includes(role) && !(item.href === "/onboarding" && onboardingDone),
  );
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
