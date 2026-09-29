"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOutIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SettingsIcon } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WorkspaceSwitcher, type SwitcherWorkspace } from "@/features/workspaces/components/workspace-switcher";
import { cn } from "@/lib/utils";
import { isActivePath, navFor, navSections, type NavAccess, type NavItem } from "./nav-config";

export const SIDEBAR_COOKIE = "foundry-sidebar";

type NavProps = {
  access: NavAccess;
  badges: Record<string, number>;
};

export type SwitcherProps = { current: SwitcherWorkspace; workspaces: SwitcherWorkspace[] };

/**
 * Desktop navigation: a full-height column with grouped links. It can
 * collapse to icons only; the choice is remembered in a cookie so it renders
 * correctly on the server.
 */
export function AppSidebar({
  defaultExpanded,
  switcher,
  ...nav
}: NavProps & { defaultExpanded: boolean; switcher: SwitcherProps }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "expanded" : "collapsed"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <aside
      data-expanded={expanded}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 lg:flex",
        expanded ? "w-60" : "w-16",
      )}
    >
      <div className={cn("flex h-14 shrink-0 items-center", expanded ? "px-3" : "px-2")}>
        <WorkspaceSwitcher {...switcher} expanded={expanded} />
      </div>

      <NavList {...nav} expanded={expanded} className="flex-1 overflow-y-auto px-3 py-2" />

      <div className="grid gap-0.5 border-t p-3">
        <NavLink
          href="/settings"
          label="Settings"
          icon={SettingsIcon}
          active={isActivePath(pathname, "/settings")}
          expanded={expanded}
        />
        <form action={signOut}>
          <NavButton label="Sign out" icon={LogOutIcon} expanded={expanded} type="submit" />
        </form>
        <NavButton
          label={expanded ? "Collapse" : "Expand"}
          icon={expanded ? PanelLeftCloseIcon : PanelLeftOpenIcon}
          expanded={expanded}
          onClick={toggle}
          type="button"
        />
      </div>
    </aside>
  );
}

/** The grouped links, shared by the sidebar and the mobile drawer. */
export function NavList({
  access,
  badges,
  expanded = true,
  onNavigate,
  itemClassName,
  className,
}: NavProps & { expanded?: boolean; onNavigate?: () => void; itemClassName?: string; className?: string }) {
  const pathname = usePathname();
  const sections = navSections(navFor(access));

  return (
    <nav className={cn("grid content-start gap-5", className)} aria-label="Main">
      {sections.map((section) => (
        <div key={section.label ?? "home"} role="group" aria-label={section.label} className="grid gap-0.5">
          {section.label &&
            (expanded ? (
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{section.label}</p>
            ) : (
              <span className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden="true" />
            ))}
          {section.items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              badge={badges[item.href]}
              active={isActivePath(pathname, item.href)}
              expanded={expanded}
              onClick={onNavigate}
              className={itemClassName}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

const itemClass = (active: boolean, expanded: boolean, className?: string) =>
  cn(
    "relative flex h-9 w-full items-center gap-3 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
    expanded ? "px-3" : "justify-center",
    active
      ? "bg-accent text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
    className,
  );

export function NavLink({
  href,
  label,
  icon: Icon,
  active,
  expanded,
  badge,
  onClick,
  className,
}: {
  href: string;
  label: string;
  icon: NavItem["icon"];
  active: boolean;
  expanded: boolean;
  badge?: number;
  onClick?: () => void;
  className?: string;
}) {
  const link = (
    <Link
      href={href}
      onClick={onClick}
      className={itemClass(active, expanded, className)}
      aria-current={active ? "page" : undefined}
    >
      <span className="relative">
        <Icon className={cn("size-4.5 shrink-0", active && "text-primary")} />
        {!!badge && !expanded && (
          <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary ring-2 ring-sidebar" />
        )}
      </span>
      {expanded && <span className="truncate">{label}</span>}
      {!!badge && expanded && <span className="ml-auto text-xs font-medium text-primary tabular">{badge}</span>}
    </Link>
  );
  if (expanded) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function NavButton({
  label,
  icon: Icon,
  expanded,
  ...props
}: React.ComponentProps<"button"> & { label: string; icon: NavItem["icon"]; expanded: boolean }) {
  const button = (
    <button className={itemClass(false, expanded)} aria-label={label} {...props}>
      <Icon className="size-4.5 shrink-0" />
      {expanded && <span className="truncate">{label}</span>}
    </button>
  );
  if (expanded) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
