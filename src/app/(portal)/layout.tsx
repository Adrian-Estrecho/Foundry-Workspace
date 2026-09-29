import { LogoMark } from "@/components/brand/logo";

/**
 * A client's project portal: no login, reached by the private link the
 * studio shares. Wider than the other public pages, for the board.
 */
export default function PortalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <main className="flex-1">{children}</main>
      <footer className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <LogoMark className="size-4" />
        Runs on ReEdit
      </footer>
    </div>
  );
}
