"use client";

import * as React from "react";
import { MessageSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Drawer = { open: boolean; setOpen: (open: boolean) => void };

const DrawerContext = React.createContext<Drawer | null>(null);

export function useCommentsDrawer() {
  const drawer = React.useContext(DrawerContext);
  if (!drawer) throw new Error("useCommentsDrawer must be used inside <TaskDetailShell>.");
  return drawer;
}

/**
 * The task page with its comments in a side panel, closed at first. The
 * button at the top right slides it in from the right: beside the task on
 * wide screens, over it on smaller ones. A link to #comments (mention
 * notifications) opens it.
 */
export function TaskDetailShell({ drawer, children }: { drawer: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const fromHash = () => {
      if (window.location.hash === "#comments") setOpen(true);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      // Escape closes the overlay on small screens; on wide ones the panel is part of the page.
      if (event.key === "Escape" && !window.matchMedia("(min-width: 1024px)").matches) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <DrawerContext.Provider value={{ open, setOpen }}>
      {/* Wide screens: the panel sits flush against the window's right edge, under the top bar. */}
      <div className="lg:-mt-6 lg:-mr-8 lg:-mb-12 lg:flex lg:items-start">
        <div className="min-w-0 flex-1 lg:pt-6 lg:pr-8 lg:pb-12">{children}</div>

        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className={cn(
            "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />
        <aside
          id="task-comments"
          aria-label="Comments"
          inert={!open}
          className={cn(
            "fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-hidden border-l bg-background transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "translate-x-full",
            "lg:sticky lg:top-14 lg:z-auto lg:h-[calc(100dvh-3.5rem)] lg:max-w-none lg:translate-x-0 lg:transition-[width]",
            open ? "lg:w-[25rem]" : "lg:w-0 lg:border-l-0",
          )}
        >
          <div className="flex h-full w-full flex-col lg:w-[25rem]">{drawer}</div>
        </aside>
      </div>
    </DrawerContext.Provider>
  );
}

/** Opens and closes the comments panel. */
export function CommentsToggle({ count }: { count: number }) {
  const { open, setOpen } = useCommentsDrawer();
  return (
    <Button
      variant={open ? "secondary" : "outline"}
      size="sm"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-controls="task-comments"
      className={cn(open && "bg-surface-strong ring-1 ring-border")}
    >
      <MessageSquareIcon />
      Comments
      {count > 0 && (
        <span className="min-w-5 rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground tabular">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Button>
  );
}
