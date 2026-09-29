import { Logo } from "@/components/brand/logo";
import { AccentStyle } from "@/components/theme/accent-style";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { DEFAULT_ACCENT } from "@/lib/theme";
import { Timeline } from "./timeline";

/**
 * Sign in, sign up, welcome: ReEdit's own look (no workspace yet). The page
 * is a centred card, like a monitor above an editing timeline.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AccentStyle accent={DEFAULT_ACCENT} />
      <div className="flex min-h-dvh flex-col overflow-x-clip">
        <header className="flex items-center justify-between px-4 py-3 sm:px-8">
          <Logo />
          <ModeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-4">{children}</main>
        <Timeline className="pb-6" />
      </div>
    </>
  );
}
