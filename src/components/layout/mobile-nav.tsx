"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { MenuIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { WorkspaceSwitcher } from "@/features/workspaces/components/workspace-switcher";
import { NavLink, NavList, type SwitcherProps } from "./app-sidebar";
import { isActivePath, type NavAccess } from "./nav-config";

/** Slide-out navigation for phones and tablets. */
export function MobileNav({
  access,
  badges,
  switcher,
}: {
  access: NavAccess;
  badges: Record<string, number>;
  switcher: SwitcherProps;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col gap-0 bg-sidebar p-0">
        <SheetHeader className="h-14 justify-center px-3">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <WorkspaceSwitcher {...switcher} />
        </SheetHeader>
        <NavList
          access={access}
          badges={badges}
          onNavigate={close}
          itemClassName="h-11"
          className="flex-1 overflow-y-auto px-3 py-2"
        />
        <div className="border-t p-3">
          <NavLink
            href="/settings"
            label="Settings"
            icon={SettingsIcon}
            active={isActivePath(pathname, "/settings")}
            expanded
            onClick={close}
            className="h-11"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
